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
import { Classroom, SendInvitationRequest, UserClassroom } from '../models'
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
import { hashSha256 } from '../common/helpers'
import { nanoid } from 'nanoid'
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
    classroom: Classroom,
  ): Promise<Classroom> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    classroom.hostId = user.id
    classroom.id = nanoid(8)
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

    const userClassrooms = await this.userClassroomRepository.find({
      where: { userId: user.id },
      include: [{ relation: 'classroom', scope: { ...filter } }, { relation: 'user' }],
    })
    filter.where = { ...filter.where, hostId: user.id }
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
    @param.path.string('id') id: string,
    @param.filter(Classroom, { exclude: 'where' }) filter?: FilterExcludingWhere<Classroom>,
  ): Promise<GetManyClassroomResponse> {
    filter = filter ?? {}
    const getUser = await this.getCurrentUser()

    const isParticipant = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })
    const classroom = await this.classroomRepository.findById(id, filter)

    const isHost = classroom.hostId === getUser.id

    if (!isParticipant && !isHost) {
      throw new HttpErrors['400']('Bạn không phải là thành viên của lớp.')
    }

    const currentUser = await this.userRepository.findById(getUser.id)

    return new GetManyClassroomResponse({
      ...classroom,
      user: new UserWithRole({
        ...currentUser,
        userRole: isParticipant?.userRole ?? ClassroomRole.HOST,
        studentId: isParticipant?.studentId,
      }),
    })
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
  async findUsersOfClassroom(@param.path.string('id') id: string): Promise<UserWithRole[]> {
    const getUser = await this.getCurrentUser()

    // Kiểm tra xem user hiện tại có phải thành viên lớp hay ko
    const isParticipant = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })

    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')

    const isHost = classroom.hostId === getUser.id

    if (!isParticipant && !isHost) {
      throw new HttpErrors['403']('Bạn không có quyền truy cập.')
    }

    const userClassrooms = await this.userClassroomRepository.find({
      where: { classroomId: id },
      include: ['user'],
    })

    const usersInClassroom: UserWithRole[] = []
    const host = await this.userRepository.findById(classroom.hostId)
    // Thêm host vào danh sách
    usersInClassroom.push(
      new UserWithRole({
        ...host,
        userRole: ClassroomRole.HOST,
      }),
    )

    // Tìm các thành viên trong lớp
    for (const userClassroom of userClassrooms) {
      const temp = new UserWithRole({
        userRole: userClassroom.userRole,
        ...userClassroom.user,
        studentId: userClassroom.studentId,
      })
      usersInClassroom.push(temp)
    }

    return usersInClassroom
    // return classroom
  }

  @authenticate('jwt')
  @post('/classrooms/{id}')
  @response(204, {
    description: 'Classroom PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Classroom, {
            partial: true,
            exclude: ['createdAt', 'updatedAt'],
          }),
        },
      },
    })
    classroomBody: Classroom,
  ): Promise<Classroom> {
    const classroom = await this.classroomRepository.findById(id)
    const getUser = await this.getCurrentUser()
    const isTeacher = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        classroomId: classroom.id,
        role: ClassroomRole.TEACHER,
      },
    })
    if (classroom.hostId !== getUser.id && !isTeacher) {
      throw new HttpErrors.Unauthorized('Bạn không được quyền sửa thông tin lớp học.')
    }
    Object.assign(classroom, classroomBody)
    return this.classroomRepository.save(classroom)
  }

  @authenticate('jwt')
  @get('/classrooms/{classroomId}/check-join-class')
  @response(200, {
    description: 'User accepts become teacher',
  })
  async checkJoinedClass(
    @param.path.string('classroomId') classroomId: string,
  ): Promise<{ isJoined: boolean }> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)

    const classroom = await this.classroomRepository.findById(classroomId)
    const userClassroom = await this.userClassroomRepository.findOne({
      where: { userId: user.id, classroomId: classroom.id },
    })

    const isJoined = classroom.hostId === user.id || userClassroom != null
    return {
      isJoined,
    }
  }

  @authenticate('jwt')
  @post('/classrooms/{classroomId}/accept-invitation/')
  @response(200, {
    description: 'User accepts become teacher',
  })
  async acceptInvitation(
    @param.path.string('classroomId') classroomId: string,
    @param.query.string('role') role: ClassroomRole,
    @param.query.string('token') token: string,
  ): Promise<void> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    role = role ?? ClassroomRole.STUDENT
    if (role === ClassroomRole.HOST)
      throw new HttpErrors['403']('Bạn không thể thực hiện hành động này.')
    if (!(role in ClassroomRole)) throw new HttpErrors['400']('Vai trò không hợp lệ.')

    const classroom = await this.classroomRepository.findById(classroomId)
    const userClassroom = await this.userClassroomRepository.findOne({
      where: { userId: user.id, classroomId: classroom.id },
    })

    const hashToken = hashSha256(`${classroomId}|${role}|${user.email}`)
    if (token || role === ClassroomRole.TEACHER) {
      if (hashToken !== token) {
        throw new HttpErrors['403'](
          'Lời mời không hợp lệ. Vui lòng liên hệ với giáo viên hoặc quản trị viên lớp học.',
        )
      }
    }

    if (classroom.hostId === user.id || userClassroom) {
      throw new HttpErrors['400']('Bạn đã tham gia lớp này rồi.')
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
    @param.path.string('classroomId') classroomId: string,
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
    const user = await this.getCurrentUser()

    role = role ?? ClassroomRole.STUDENT
    if (role === ClassroomRole.HOST)
      throw new HttpErrors['403']('Bạn không thể thực hiện hành động này.')
    if (!(role in ClassroomRole)) throw new HttpErrors['400']('Vai trò không hợp lệ.')

    const classroom = await this.classroomRepository.findById(classroomId)

    const isTeacher = await this.userClassroomRepository.findOne({
      where: {
        userId: user.id,
        classroomId: classroom.id,
        userRole: ClassroomRole.TEACHER,
      },
    })
    // authorize user if user is teacher or host
    if (classroom.hostId !== user.id && !isTeacher) {
      throw new HttpErrors.Forbidden('Bạn không có quyền truy cập.')
    }

    const invitee = `${user.fullname} (${user.email})`

    const subject = 'Lời mời tham gia lớp học'

    const classroomName = classroom.name

    const emails = body.userEmails

    for (const email of emails) {
      // create token by using sha256
      // template: classroomId|role|userId

      const token = hashSha256(`${classroomId}|${role}|${email}`)

      const webLink =
        process.env.WEB_LINK + `/invitation?classroomId=${classroomId}&role=${role}&token=${token}`

      const emailData: IEmailRequest = {
        classroomName,
        from: 'gradeflix@gmail.com',
        invitee,
        role: role === ClassroomRole.TEACHER ? 'Giáo viên' : 'Học sinh',
        to: email,
        subject,
        link: webLink,
      }

      // Catch error and keep sending other emails.
      try {
        await this.emailManager.sendMail(emailData)
      } catch (error) {
        console.log('error when sending invitation', error)
      }
    }
  }
}
