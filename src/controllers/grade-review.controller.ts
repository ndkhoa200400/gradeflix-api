/* eslint-disable @typescript-eslint/no-floating-promises */
import { inject, intercept } from '@loopback/core'
import { Filter, Getter, repository } from '@loopback/repository'
import {
  post,
  param,
  get,
  getModelSchemaRef,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest'
import {
  FinalGradeRequest,
  Grade,
  GradeReview,
  Notification,
  User,
  UserClassroom,
  UserClassroomRelations,
} from '../models'
import {
  ClassroomRepository,
  GradeReviewRepository,
  GradesRepository,
  NotificationRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { AuthenRoleClassroomInterceptor, CheckJoinClassroomInterceptor } from '../interceptors'
import { authenticate } from '@loopback/authentication'
import { ClassroomRole } from '../constants/role'
import { GradeReviewStatus } from '../constants/status'
import { validateGrade } from '../common/helpers'
import { GradeReviewNotFoundError, StudentIdRequiredError } from '../common/error-hanlder'
import { SocketIoService } from '../services'

@authenticate('jwt')
export class GradeReviewController {
  constructor(
    @repository(GradeReviewRepository)
    public gradeReviewRepository: GradeReviewRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @inject('services.socketio')
    public socketIoService: SocketIoService,
  ) {}

  @post('/classrooms/{id}/grade-reviews')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'GradeReview model instance',
    content: { 'application/json': { schema: getModelSchemaRef(GradeReview) } },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GradeReview, {
            partial: true,
            exclude: ['id', 'createdAt', 'updatedAt', 'studentId', 'classroomId'],
          }),
        },
      },
    })
    gradeReviewRequestBody: Omit<GradeReview, 'id'>,
  ): Promise<GradeReview> {
    const getUser = await this.getCurrentUser()
    const isValid = await this.checkValidGradeToGradeStructure(
      id,
      gradeReviewRequestBody.expectedGrade,
    )
    if (!isValid) throw new HttpErrors.BadRequest('Điểm không hợp lệ với thang điểm của lớp.')
    const user = await this.userRepository.findById(getUser.id)
    if (!user.studentId) throw new StudentIdRequiredError()

    // Check if grade review already exists
    const gradeReviews = await this.gradeReviewRepository.find({
      where: {
        classroomId: id,
        studentId: user.studentId,
      },
    })
    if (gradeReviews) {
      for (const gradeReview of gradeReviews) {
        if (gradeReview.currentGrade.name === gradeReviewRequestBody.expectedGrade.name) {
          if (gradeReview.status === GradeReviewStatus.FINAL)
            Object.assign(gradeReview, gradeReviewRequestBody)
          return this.gradeReviewRepository.save(gradeReview)
        }
      }
    }

    const studentInList = await this.studentListRepository.findOne({
      where: {
        classroomId: id,
        studentId: user.studentId,
      },
    })
    if (!studentInList)
      throw new HttpErrors['404']('Không tìm thấy sinh viên khớp với mã số sinh viên này.')

    const currentGrade = await this.gradesRepository.findOne({
      where: {
        studentListId: studentInList.id,
        name: gradeReviewRequestBody.expectedGrade.name,
      },
    })

    if (!currentGrade)
      throw new HttpErrors['400'](
        `Thang điểm ${gradeReviewRequestBody.expectedGrade.name} chưa được chấm.`,
      )

    gradeReviewRequestBody.currentGrade = new Grade({
      name: currentGrade.name,
      grade: currentGrade.grade,
    })
    gradeReviewRequestBody.studentId = user.studentId
    gradeReviewRequestBody.classroomId = id
    const gradeReview = await this.gradeReviewRepository.create(gradeReviewRequestBody)

    // send noti to all teachers
    this.notifyNewGradeReview(id, user, gradeReview)

    return gradeReview
  }

  async notifyNewGradeReview(classroomId: string, user: User, gradeReview: GradeReview) {
    const classroom = await this.classroomRepository.findById(classroomId)
    const teachers = await this.userClassroomRepository.find({
      where: {
        classroomId: classroom.id,
        userRole: ClassroomRole.TEACHER,
      },
    })
    const notifications: Notification[] = []

    for (const teacher of teachers) {
      const notification = new Notification({
        content: `Học sinh ${user.fullname} yêu cầu phúc khảo ở lớp ${classroom.name}`,
        link: `/classrooms/${classroom.id}/tab-review-grade/${gradeReview.id}`,
        userId: teacher.userId,
      })
      notifications.push(notification)
    }
    // for host
    const notification = new Notification({
      content: `Học sinh ${user.fullname} yêu cầu phúc khảo ở lớp ${classroom.name}`,
      link: `/classrooms/${classroom.id}/tab-review-grade/${gradeReview.id}`,
      userId: classroom.hostId,
    })
    notifications.push(notification)
    this.notifyToTeachers(notifications)
  }

  async notifyToTeachers(notifications: Notification[]) {
    const notificationsResponse = await this.notificationRepository.createAll(notifications)
    for (const notification of notificationsResponse) {
      await this.socketIoService.sendNotification(notification.userId, notification)
    }
  }

  @get('/classrooms/{id}/grade-reviews')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Find all GradeReview model instances by classroom id',
    content: {
      'application/json': {
        schema: getModelSchemaRef(GradeReview, { includeRelations: true }),
      },
    },
  })
  async findByClassroom(
    @param.path.string('id') id: string,
    @param.filter(GradeReview) filter?: Filter<GradeReview>,
  ): Promise<GradeReview[]> {
    filter = filter ?? {}
    const getUser = await this.getCurrentUser()
    const classroom = await this.classroomRepository.findById(id)
    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        classroomId: id,
      },
    })
    if (!userClassroom && classroom.hostId !== getUser.id) return []
    if (userClassroom?.userRole === ClassroomRole.STUDENT) {
      const user = await this.userRepository.findById(getUser.id)
      if (!user.studentId) throw new StudentIdRequiredError()
      return this.gradeReviewRepository.find({
        where: {
          classroomId: id,
          studentId: user.studentId,
        },
        include: ['user'],
        order: ['createdAt DESC'],
      })
    }

    filter.include = [...(filter.include ?? []), 'user']
    filter.where = { ...filter.where, classroomId: id }
    filter.order = ['createdAt DESC']
    return this.gradeReviewRepository.find(filter)
  }

  @get('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Find one GradeReview model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(GradeReview, { includeRelations: true }),
      },
    },
  })
  async getGradeReview(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @param.filter(GradeReview) filter?: Filter<GradeReview>,
  ): Promise<GradeReview | null> {
    filter = filter ?? {}
    const getUser = await this.getCurrentUser()
    filter.include = [...(filter.include ?? []), 'user']
    filter.where = { ...filter.where, classroomId: classroomId, id: gradeReviewId }
    const gradeReview = await this.gradeReviewRepository.findOne(filter)
    if (!gradeReview) throw new HttpErrors['404']('Không tìm thấy yêu cầu.')

    const userClassroom = (await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
      include: ['user'],
    })) as UserClassroom & UserClassroomRelations

    const classroom = await this.classroomRepository.findById(classroomId)
    // If teacher => get all reviews of the classroom
    if (classroom.hostId === getUser.id || userClassroom.userRole === ClassroomRole.TEACHER) {
      if (gradeReview.status === GradeReviewStatus.PENDING) {
        gradeReview.status = GradeReviewStatus.PROCESSING
        await this.gradeReviewRepository.updateById(gradeReview.id, {
          status: GradeReviewStatus.PROCESSING,
        })
      }
    } else {
      const user: User = userClassroom.user
      if (!user.studentId) throw new StudentIdRequiredError()
      if (user.studentId !== gradeReview.studentId) {
        throw new HttpErrors['404']('Không tìm thấy yêu cầu.')
      }
    }
    return gradeReview
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}')
  @response(200, {
    description: 'GradeReview FINALIZED success',
  })
  async finalizeGradeReview(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(FinalGradeRequest, { partial: true }),
        },
      },
    })
    finalGradeRequestBody: FinalGradeRequest,
  ): Promise<GradeReview> {
    const classroom = await this.classroomRepository.findById(classroomId)
    if (!classroom.gradeStructure) throw new HttpErrors['400'](`Vui lòng thêm thang điểm cho lớp.`)

    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
        classroomId: classroomId,
      },
    })
    if (!gradeReview) throw new GradeReviewNotFoundError()

    const studentList = await this.studentListRepository.findOne({
      where: {
        classroomId: classroom.id,
        studentId: finalGradeRequestBody.studentId,
      },
    })

    if (!studentList)
      throw new HttpErrors['404'](`Không tìm thấy sinh viên ${finalGradeRequestBody.studentId}.`)

    // Find student's grade with grade name
    const grade = await this.gradesRepository.findOne({
      where: {
        studentListId: studentList?.id,
        name: finalGradeRequestBody.name,
      },
    })

    // Validate data
    if (!grade)
      throw new HttpErrors['404'](`Không tìm thấy thang điểm ${finalGradeRequestBody.name}.`)

    if (!validateGrade(finalGradeRequestBody.grade, classroom.gradeStructure))
      throw new HttpErrors['400'](
        `Điểm ${finalGradeRequestBody.grade} không hợp lệ với thang điểm của lớp.`,
      )

    gradeReview.status = GradeReviewStatus.FINAL
    grade.grade = finalGradeRequestBody.grade
    await this.gradesRepository.save(grade)

    // notify to student
    const user = await this.userRepository.findOne({
      where: {
        studentId: gradeReview.studentId,
      },
    })
    if (user) {
      const notification = await this.notificationRepository.create({
        content: `Đơn phúc khảo cho thang điểm ${grade.grade} đã có bản chính thức.`,
        link: `/classrooms/${classroomId}/tab-review-grade/${gradeReview.id}`,
        userId: user.id,
      })
      await this.socketIoService.sendNotification(user?.id as number, notification)
    }
    return this.gradeReviewRepository.save(gradeReview)
  }

  /**
   * Check if grade is valid to grade structure of classroom
   * Throw error when classroom hasn't has grade structure yet
   * @returns boolean - true if valid, false if invalid
   */
  async checkValidGradeToGradeStructure(classroomId: string, grade: Grade) {
    const classroom = await this.classroomRepository.findById(classroomId)

    if (!classroom.gradeStructure)
      throw new HttpErrors['400']('Lớp chưa có thang điểm. Vui lòng liên hệ giáo viên để thêm')

    const numberGrade = Number(grade.grade)
    if (
      Number.isNaN(numberGrade) ||
      Number(classroom.gradeStructure.total) < numberGrade ||
      numberGrade < 0
    )
      return false

    return true
  }
}
