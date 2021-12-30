import { authenticate } from '@loopback/authentication'
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
import { Classroom, GradeStructure, Notification, SendInvitationRequest } from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  NotificationRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { EmailManager, InvitationEmailRequest, SocketIoService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { ClassroomRole } from '../constants/role'
import { ClassroomWithUserResponse, ClassroomWithUsersResponse, UserWithRole } from '../models/'
import { EmailManagerBindings } from '../keys'
import { hashSha256 } from '../common/helpers'
import { nanoid } from 'nanoid'
import { AuthenRoleClassroomInterceptor } from '../interceptors/authen-role-classroom.interceptor'
import { CheckJoinClassroomInterceptor } from '../interceptors/'
import calculateTotal from '../common/helpers/calculate-grade-total'
export class ClassroomController {
  constructor(
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(EmailManagerBindings.SEND_MAIL)
    public emailManager: EmailManager,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @inject('services.socketio')
    public socketIoService: SocketIoService,
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
    classroom.code = nanoid(4)
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
          items: getModelSchemaRef(ClassroomWithUserResponse, { includeRelations: true }),
        },
      },
    },
  })
  async find(
    @param.filter(Classroom) filter: Filter<Classroom>,
  ): Promise<ClassroomWithUserResponse[]> {
    filter = filter ?? {}
    const currentUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(currentUser.id)

    const userClassrooms = await this.userClassroomRepository.find({
      where: { userId: user.id },
      include: [{ relation: 'classroom', scope: { ...filter } }, { relation: 'user' }],
    })
    filter.where = { ...filter.where, hostId: user.id }
    const hostedClassrooms = await this.classroomRepository.find(filter)

    const result: ClassroomWithUserResponse[] = []

    // find classrooms that current user is the host
    for (const hostedClassroom of hostedClassrooms) {
      const temp = new ClassroomWithUserResponse({
        ...hostedClassroom,
        user: user,
      })
      result.push(temp)
    }

    // find classrooms that user has joined
    for (const userClassroom of userClassrooms) {
      const temp = new ClassroomWithUserResponse({
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
  ): Promise<ClassroomWithUserResponse> {
    filter = filter ?? ({} as FilterExcludingWhere<Classroom>)
    const getUser = await this.getCurrentUser()

    const userClassroom = await this.userClassroomRepository.findOne({
      where: { classroomId: id, userId: getUser.id },
    })

    const classroom = await this.classroomRepository.findById(id, filter)

    const currentUser = await this.userRepository.findById(getUser.id)

    return new ClassroomWithUserResponse({
      ...classroom,
      user: new UserWithRole({
        ...currentUser,
        userRole: userClassroom?.userRole ?? ClassroomRole.HOST,
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
        schema: getModelSchemaRef(ClassroomWithUsersResponse, { includeRelations: true }),
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
    description: 'Grade Structure of classroom PATCH success',
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
    this.validateGradeStructure(grade)

    await this.removeRedundantGrade(classroom, grade)
    const students = await this.userClassroomRepository.find({
      where: {
        classroomId: classroom.id,
        userRole: ClassroomRole.STUDENT,
      },
    })
    for (const gradeComposition of grade.gradeCompositions) {
      gradeComposition.isFinal = gradeComposition.isFinal ?? false

      // check if new grade composition is marked as final
      // then notify to students
      if (classroom.gradeStructure) {
        const currentGradeComposition = classroom.gradeStructure.gradeCompositions.find(item => {
          if (item.name === gradeComposition.name) {
            return item
          }
        })
        if (currentGradeComposition) {
          if (gradeComposition.isFinal === true && currentGradeComposition.isFinal === false) {
            // Send notifications to all students in class
            const notifications: Notification[] = []
            for (const student of students) {
              notifications.push(
                new Notification({
                  content: `Lớp ${classroom.name} đã có điểm ${gradeComposition.name}`,
                  link: `/classrooms/${classroom.id}/tab-my-info/`,
                  userId: student.userId,
                }),
              )
            }
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.notifyToStudents(notifications)
          }
        }
      }
    }
    classroom.gradeStructure = grade
    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroom.id,
      },
      include: ['grades'],
    })

    // Calculate total
    for (const student of studentList) {
      const total = calculateTotal(student.grades, classroom.gradeStructure).toString()
      // If total is different from the previous one => update
      if (total !== student.total) {
        student.total = total
        await this.studentListRepository.updateById(student.id, { total: student.total })
      }
    }

    return this.classroomRepository.save(classroom)
  }

  async notifyToStudents(notifications: Notification[]) {
    const notificationsResponse = await this.notificationRepository.createAll(notifications)
    for (const notification of notificationsResponse) {
      await this.socketIoService.sendNotification(notification.userId, notification)
    }
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

    Object.assign(classroom, classroomBody)
    return this.classroomRepository.save(classroom)
  }

  @authenticate('jwt')
  @get('/classrooms/{id}/check-join-class')
  @response(200, {
    description: 'User accepts become teacher',
  })
  async checkJoinedClass(
    @param.path.string('id') classroomId: string,
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
  @post('/classrooms/{id}/accept-invitation/')
  @response(200, {
    description: 'User accepts become teacher',
  })
  async acceptInvitation(
    @param.path.string('id') classroomId: string,
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
        throw new HttpErrors['401'](
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
  @post('/classrooms/{id}/send-invitation/')
  @response(204, {
    description: 'Send invitation by email',
  })
  async sendInvitation(
    @param.path.string('id') classroomId: string,
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
    if (role === ClassroomRole.HOST) throw new HttpErrors['403']('Vai trò không hợp lệ.')
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

      const emailData: InvitationEmailRequest = {
        classroomName,
        from: 'gradeflix@gmail.com',
        invitee,
        role: role === ClassroomRole.TEACHER ? 'Giáo viên' : 'Học sinh',
        to: email,
        subject,
        link: webLink,
        template: './src/common/helpers/invitation-email.template.html',
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
   * Validate whether the total of all grade compositions is equal to the total of the grade structure or not
   * @param grade grade structure of a classroom
   * @returns pass if grade is valid, throw exception if not
   */
  validateGradeStructure(grade: GradeStructure) {
    let total = 0
    if (!Number(grade.total) || Number(grade.total) < 1)
      throw new HttpErrors['400']('Tổng điểm phải lớn hơn 0')

    for (const gradeComposition of grade.gradeCompositions) {
      if (!Number(gradeComposition.percent))
        throw new HttpErrors['400']('Định dạng thang điểm không hợp lệ')
      const percent = parseFloat(gradeComposition.percent)
      if (percent < 1) throw new HttpErrors['400']('Thang điểm phải lớn hơn 0')
      total += parseFloat(gradeComposition.percent)
    }

    if (total !== 100) throw new HttpErrors['400']('Tổng thang điểm phải đạt 100%')
  }

  /**
   * Remove redundant grades of student list when update classroom's grade structure which are no longer in the grade structure
   */
  async removeRedundantGrade(classroom: Classroom, newGradeStructure: GradeStructure) {
    if (!classroom.gradeStructure) return
    const currentGradeStructure = classroom.gradeStructure
    const newGradesName = newGradeStructure.gradeCompositions.map(
      gradeComposition => gradeComposition.name,
    )
    const redundantGradeNames = currentGradeStructure.gradeCompositions
      .filter(gradeComposition => !newGradesName.includes(gradeComposition.name))
      .map(gradeComposition => gradeComposition.name)
    const studentListIds = (
      await this.studentListRepository.find({ where: { classroomId: classroom.id } })
    ).map(student => student.id)
    await this.gradesRepository.deleteAll({
      name: { inq: redundantGradeNames },
      studentListId: { inq: studentListIds },
    })
  }
}
