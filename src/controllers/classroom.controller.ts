import { authenticate } from '@loopback/authentication'
import { UserServiceBindings } from '@loopback/authentication-jwt'
import { Getter, inject, intercept } from '@loopback/core'
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
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest'
import { Classroom, GradeStructure, SendInvitationRequest } from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { EmailManager, IEmailRequest, MyUserService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { ClassroomRole } from '../constants/classroom-role'
import { GetManyClassroomResponse, GetOneClassroomResponse, UserWithRole } from '../models/'
import { EmailManagerBindings } from '../keys'
import { hashSha256 } from '../common/helpers'
import { nanoid } from 'nanoid'
import { AuthenRoleClassroomInterceptor } from '../interceptors/authen-role-classroom.interceptor'
import { CheckJoinClassroomInterceptor } from '../interceptors/check-join-classroom.interceptor'
import calculateTotal from '../common/helpers/calculate-grade-total'
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
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
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
    // Kiểm tra barem điểm có hợp lệ k
    // if (classroom.barem) {
    //   const isBaremValid = this.validateBarem(classroom.barem)
    //   if (!isBaremValid) throw new HttpErrors['400']('Barem điểm không hợp lệ!')
    // }
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    classroom.hostId = user.id
    classroom.id = nanoid(8)
    const res = await this.classroomRepository.create(classroom)
    const result = await this.classroomRepository.findById(res.id, { include: ['host'] })
    return result
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

    const result: GetManyClassroomResponse[] = []

    // find classrooms that current user is the host
    for (const hostedClassroom of hostedClassrooms) {
      const temp = new GetManyClassroomResponse({
        ...hostedClassroom,
        user: user,
      })
      result.push(temp)
    }

    // find classrooms that user has joined
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
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
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
    filter = filter ?? ({} as FilterExcludingWhere<Classroom>)
    const getUser = await this.getCurrentUser()

    const userClassroom = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })

    const classroom = await this.classroomRepository.findById(id, filter)

    const currentUser = await this.userRepository.findById(getUser.id)

    return new GetManyClassroomResponse({
      ...classroom,
      user: new UserWithRole({
        ...currentUser,
        userRole: userClassroom?.userRole ?? ClassroomRole.HOST,
        studentId: userClassroom?.studentId,
      }),
    })
  }

  @authenticate('jwt')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
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
    const classroom = await this.classroomRepository.findById(id)

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
  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/grade-structure')
  @response(204, {
    description: 'Classroom PATCH success',
  })
  async updateGradeStructure(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GradeStructure, {
            partial: true,
          }),
        },
      },
    })
    grade: GradeStructure,
  ): Promise<Classroom> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })

    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')
    this.validateParem(grade)

    classroom.gradeStructure = grade
    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroom.id,
      },
      include: ['grades'],
    })
    for (const student of studentList) {
      const total = calculateTotal(student.grades, classroom.gradeStructure).toString()

      if (total !== student.total) {
        student.total = total
        await this.studentListRepository.updateById(student.id, { total: student.total })
      }
    }
    return this.classroomRepository.save(classroom)
  }

  @authenticate('jwt')
  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/grade-structure/delete')
  @response(204, {
    description: 'Classroom PATCH success',
  })
  async deleteGrade(@param.path.string('id') id: string): Promise<Classroom> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })

    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')
    classroom.gradeStructure = undefined
    return this.classroomRepository.save(classroom)
  }

  @authenticate('jwt')
  @post('/classrooms/{id}')
  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
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
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')
    const getUser = await this.getCurrentUser()
    const isTeacher = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        classroomId: classroom.id,
        userRole: ClassroomRole.TEACHER,
      },
    })
    if (classroom.hostId !== getUser.id && !isTeacher) {
      throw new HttpErrors.Unauthorized('Bạn không được quyền sửa thông tin lớp học.')
    }
    // if (classroomBody.barem) {
    //   const isBaremValid = this.validateBarem(classroomBody.barem)
    //   if (!isBaremValid) throw new HttpErrors['400']('Barem điểm không hợp lệ!')
    // }
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

    const classroom = await this.classroomRepository.findOne({
      where: {
        id: classroomId,
      },
    })
    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')
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

    const classroom = await this.classroomRepository.findOne({ where: { id: classroomId } })
    if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học')
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
  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{classroomId}/send-invitation/')
  @response(204, {
    description: 'Send invitation by email',
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
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    role = role ?? ClassroomRole.STUDENT
    if (role === ClassroomRole.HOST)
      throw new HttpErrors['403']('Bạn không thể thực hiện hành động này.')
    if (!(role in ClassroomRole)) throw new HttpErrors['400']('Vai trò không hợp lệ.')

    const classroom = await this.classroomRepository.findById(classroomId)

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

  /**
   *
   * @param grade grade structure of a classroom
   * @returns pass if grade is valid, throw exception if not
   */
  validateParem(grade: GradeStructure) {
    let total = 0
    if (!Number(grade.total) || Number(grade.total) < 1)
      throw new HttpErrors['400']('Tổng điểm phải lớn hơn 0')

    for (const parem of grade.parems) {
      if (!Number(parem.percent)) throw new HttpErrors['400']('Định dạng thang điểm không hợp lệ')
      const percent = parseFloat(parem.percent)
      if (percent < 1) throw new HttpErrors['400']('Thang điểm phải lớn hơn 0')
      total += parseFloat(parem.percent)
    }

    if (total !== 100) throw new HttpErrors['400']('Tổng thang điểm phải đạt 100%')
  }
}
