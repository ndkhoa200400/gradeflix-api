import { authenticate } from '@loopback/authentication'
import { User, UserServiceBindings } from '@loopback/authentication-jwt'
import { Getter, inject } from '@loopback/core'
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository'
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest'
import { Classroom, SendInvitationRequest } from '../models'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { EmailManager, IEmailRequest, MyUserService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { ClassroomRole } from '../constants/classroom-role'
import {
  GetManyClassroomResponse,
  GetOneClassroomResponse,
  UserWithRole,
} from '../models/classroom-response.model'
import { EmailManagerBindings } from '../keys'
export class ClassroomController {
  constructor(
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(EmailManagerBindings.SEND_MAIL) public emailManager: EmailManager,
  ) {}

  @authenticate('jwt')
  @post('/classrooms')
  @response(200, {
    description: 'Classroom model instance',
    content: { 'application/json': { schema: getModelSchemaRef(Classroom) } },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Classroom, {
            title: 'NewClassroom',
            exclude: ['id', 'hostId', 'createdAt', 'updatedAt'],
          }),
        },
      },
    })
    classroom: Omit<Classroom, 'id'>,
  ): Promise<Classroom> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    classroom.hostId = user.id
    return this.classroomRepository.create(classroom)
  }

  @get('/classrooms/count')
  @response(200, {
    description: 'Classroom model count',
    content: { 'application/json': { schema: CountSchema } },
  })
  async count(@param.where(Classroom) where?: Where<Classroom>): Promise<Count> {
    return this.classroomRepository.count(where)
  }

  @authenticate('jwt')
  @get('/classrooms')
  @response(200, {
    description: 'Array of Classroom model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(GetManyClassroomResponse, { includeRelations: true }),
        },
      },
    },
  })
  async find(
    @param.filter(Classroom) filter: Filter<Classroom>,
  ): Promise<GetManyClassroomResponse[]> {
    filter = filter ?? {}
    const currentUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(currentUser.id)

    filter.where = { ...filter.where, hostId: user.id }
    const userClassrooms = await this.userClassroomRepository.find({
      where: { userId: user.id },
      include: ['classroom', 'user'],
    })
    const hostedClassrooms = await this.classroomRepository.find(filter)
    // const result = hostedClassrooms.concat(participatedClassrooms)

    // return result
    const result: GetManyClassroomResponse[] = []
    // find classrooms that user is host
    for (const hostedClassroom of hostedClassrooms) {
      const temp = new GetManyClassroomResponse({
        ...hostedClassroom,
        user: user,
      })
      result.push(temp)
    }

    // find classrooms that user participated
    for (const userClassroom of userClassrooms) {
      const temp = new GetManyClassroomResponse({
        ...userClassroom.classroom,
        user: new UserWithRole({
          ...user,
          userRole: userClassroom.userRole,
        }),
      })
      result.push(temp)
    }
    return result
  }

  @authenticate('jwt')
  @get('/classrooms/{id}')
  @response(200, {
    description: 'Classroom model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Classroom, { includeRelations: true }),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Classroom, { exclude: 'where' }) filter?: FilterExcludingWhere<Classroom>,
  ): Promise<Classroom> {
    const getUser = await this.getCurrentUser()
    const isParticipant = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })

    if (!isParticipant) {
      throw new HttpErrors['404']('Classrooms not found on this user')
    }
    const classroom = await this.classroomRepository.findById(id, filter)
    return classroom
  }

  @authenticate('jwt')
  @get('/classrooms/{id}/users')
  @response(200, {
    description: 'Classroom model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(GetOneClassroomResponse, { includeRelations: true }),
      },
    },
  })
  async findUsersOfClassroom(
    @param.path.number('id') id: number,
  ): Promise<GetOneClassroomResponse> {
    const getUser = await this.getCurrentUser()
    const isParticipant = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })
    const isHosted = await this.classroomRepository.findOne({
      where: {
        hostId: getUser.id,
        classroomId: id,
      },
    })
    if (!isParticipant && !isHosted) {
      throw new HttpErrors['404']('Classrooms not found on this user')
    }
    const classroom = await this.classroomRepository.findById(id, { include: ['host'] })
    const userClassrooms = await this.userClassroomRepository.find({
      where: { classroomId: id },
      include: ['user'],
    })
    const usersInClassroom: UserWithRole[] = []

    // Tìm các thành viên trong lớp
    for (const userClassroom of userClassrooms) {
      const temp = new UserWithRole({
        userRole: userClassroom.userRole,
        ...userClassroom.user,
      })
      usersInClassroom.push(temp)
    }

    return new GetOneClassroomResponse({ ...classroom, users: usersInClassroom })
    // return classroom
  }
  @patch('/classrooms/{id}')
  @response(204, {
    description: 'Classroom PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Classroom, { partial: true }),
        },
      },
    })
    classroom: Classroom,
  ): Promise<void> {
    await this.classroomRepository.updateById(id, classroom)
  }

  @put('/classrooms/{id}')
  @response(204, {
    description: 'Classroom PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() classroom: Classroom,
  ): Promise<void> {
    await this.classroomRepository.replaceById(id, classroom)
  }

  @del('/classrooms/{id}')
  @response(204, {
    description: 'Classroom DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.classroomRepository.deleteById(id)
  }

  @authenticate('jwt')
  @post('/classrooms/{classroomId}/accept-invitation/')
  @response(200, {
    description: 'User accepts become teacher',
  })
  async acceptInvitation(
    @param.path.number('classroomId') classroomId: number,
    @param.query.string('role') role: ClassroomRole,
  ): Promise<void> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)

    const classroom = await this.classroomRepository.findById(classroomId)
    const userClassroom = await this.userClassroomRepository.findOne({
      where: { userId: user.id, classroomId: classroom.id },
    })
    if (classroom.hostId === user.id || userClassroom) {
      throw new HttpErrors['400']('You already joined this class.')
    }
    await this.userRepository.classrooms(user.id).link(classroom.id, {
      throughData: {
        userRole: role,
      },
    })
  }

  @authenticate('jwt')
  @post('/classrooms/{classroomId}/send-invitation/')
  @response(204, {
    description: 'User UPDATE',
  })
  async sendInvitation(
    @param.path.number('classroomId') classroomId: number,
    @param.query.string('role') role: ClassroomRole,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SendInvitationRequest, { partial: true }),
        },
      },
    })
    body: SendInvitationRequest,
  ): Promise<void> {
    const email = body.userEmails

    const user = await this.getCurrentUser()
    const invitee = `${user.fullname} (${user.email})`

    const subject = 'Lời mời tham gia lớp học'

    const classroom = await this.classroomRepository.findById(classroomId)
    const classroomName = classroom.name
    const webLink = process.env.WEB_LINK + `/inv?classroomId=${classroomId}&role=${role}`
    const emailData: IEmailRequest = {
      classroomName,
      from: 'gradeflix@gmail.com',
      invitee,
      role: role === ClassroomRole.TEACHER ? 'Giáo viên' : 'Học sinh',
      to: email,
      subject,
      link: webLink,
    }
    const res = await this.emailManager.sendMail(emailData)
  }
}
