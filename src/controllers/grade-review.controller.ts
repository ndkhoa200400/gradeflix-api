import { inject, intercept } from '@loopback/core'
import { Getter, repository } from '@loopback/repository'
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
            throw new HttpErrors['400']('Bạn không thể phúc khảo. Thang điểm đã là điểm cuối cùng.')
          return gradeReview
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

    return this.gradeReviewRepository.create(gradeReviewRequestBody)
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
  async findByClassroom(@param.path.string('id') id: string): Promise<GradeReview[]> {
    const getUser = await this.getCurrentUser()

    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        classroomId: id,
      },
    })
    if (!userClassroom) return []
    if (userClassroom.userRole === ClassroomRole.STUDENT) {
      const user = await this.userRepository.findById(getUser.id)
      if (!user.studentId) throw new StudentIdRequiredError()
      return this.gradeReviewRepository.find({
        where: {
          classroomId: id,
          studentId: user.studentId,
        },
      })
    }
    return this.gradeReviewRepository.find({
      where: {
        classroomId: id,
      },
    })
  }

  @get('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Find all GradeReview model instances by classroom id',
    content: {
      'application/json': {
        schema: getModelSchemaRef(GradeReview, { includeRelations: true }),
      },
    },
  })
  async getGradeReview(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
  ): Promise<GradeReview | null> {
    const getUser = await this.getCurrentUser()

    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
        classroomId: classroomId,
      },
    })
    if (!gradeReview) throw new HttpErrors['404']('Không tìm thấy yêu cầu.')

    const userClassroom = (await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
      include: ['user', 'classroom'],
    })) as UserClassroom & UserClassroomRelations

    if (
      userClassroom.userRole === ClassroomRole.TEACHER ||
      userClassroom.classroom.hostId === getUser.id
    ) {
      if (gradeReview.status === GradeReviewStatus.PENDING) {
        gradeReview.status = GradeReviewStatus.PROCESSING
        await this.gradeReviewRepository.save(gradeReview)
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
  async finalizeGrade(
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

    // Send notifications to all students in class
    const students = await this.userClassroomRepository.find({
      where: {
        classroomId: classroom.id,
        userRole: ClassroomRole.STUDENT,
      },
    })
    const notifications: Notification[] = []
    for (const student of students) {
      notifications.push(
        new Notification({
          content: `Lớp ${classroom.name} đã có điểm tổng kết`,
          link: `/classrooms/${classroom.id}/tab-grade/`,
          userId: student.id,
        }),
      )
    }

    const notificationsResponse = await this.notificationRepository.createAll(notifications)
    for (const notification of notificationsResponse) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.socketIoService.sendMessage(notification.userId, notification.content)
    }
    await this.gradesRepository.save(grade)
    return this.gradeReviewRepository.save(gradeReview)
  }
}
