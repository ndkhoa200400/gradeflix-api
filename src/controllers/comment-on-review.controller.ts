/* eslint-disable @typescript-eslint/no-floating-promises */
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
  Classroom,
  CommentOnReview,
  CommentOnReviewWithRelations,
  Notification,
  User,
  UserClassroomWithRelations,
} from '../models'
import {
  ClassroomRepository,
  CommentOnReviewRepository,
  GradeReviewRepository,
  GradesRepository,
  NotificationRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { CheckJoinClassroomInterceptor } from '../interceptors'
import { authenticate } from '@loopback/authentication'
import { ClassroomRole } from '../constants/role'
import {
  GradeReviewNotFoundError,
  NoPermissionError,
  StudentIdRequiredError,
} from '../common/error-hanlder'
import { SocketIoService } from '../services'

@authenticate('jwt')
export class CommentOnReviewController {
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
    @repository(CommentOnReviewRepository)
    public commentOnReviewRepository: CommentOnReviewRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @inject('services.socketio')
    public socketIoService: SocketIoService,
  ) {}

  @post('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Create a comment on a grade review',
    content: { 'application/json': { schema: getModelSchemaRef(CommentOnReview) } },
  })
  async create(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CommentOnReview, {
            partial: true,
            exclude: ['id', 'createdAt', 'updatedAt', 'userId', 'gradeReviewId'],
          }),
        },
      },
    })
    commentOnReviewRequestBody: Omit<CommentOnReview, 'id'>,
  ): Promise<CommentOnReview> {
    const getUser = await this.getCurrentUser()

    await this.validateGradeReviewRole(gradeReviewId, classroomId, getUser.id)

    const gradeReview = await this.gradeReviewRepository.findById(gradeReviewId)

    const student = await this.userRepository.findOne({
      where: {
        studentId: gradeReview.studentId,
      },
    })
    if (!student)
      throw new HttpErrors['404'](`Kh??ng t??m th???y sinh vi??n v???i m?? s??? ${gradeReview.studentId}.`)

    const currentUser = await this.userRepository.findById(getUser.id)

    const classroom = await this.classroomRepository.findById(classroomId)

    // find user role for current user
    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        userId: currentUser.id,
        classroomId: classroom.id,
      },
    })
    if (getUser.id !== student.id) {
      this.notifyNewCommentToStudent(classroomId, currentUser.fullname, gradeReviewId, student)
    }
    if (userClassroom?.userRole === ClassroomRole.STUDENT) {
      const content = `H???c sinh ${student.fullname} ???? b??nh lu???n v??o ????n ph??c kh???o ??? l???p ${classroom.name}`
      this.notifyNewCommentToTeachers(classroomId, student, gradeReviewId, content)
    } else {
      const content = `Gi??o vi??n ${currentUser.fullname} ???? b??nh lu???n v??o ????n ph??c kh???o ??? l???p ${classroom.name}`
      this.notifyNewCommentToTeachers(classroomId, currentUser, gradeReviewId, content)
    }
    const comment: CommentOnReviewWithRelations = await this.commentOnReviewRepository.create({
      ...commentOnReviewRequestBody,
      userId: getUser.id,
      gradeReviewId: gradeReviewId,
    })
    comment.user = currentUser
    return comment
  }

  async notifyNewCommentToStudent(
    classroomId: string,
    teacherName: string,
    gradeReviewId: number,
    student: User,
  ) {
    const classroom = await this.classroomRepository.findById(classroomId)
    const notification = await this.notificationRepository.create(
      new Notification({
        content: `Gi??o vi??n ${teacherName} ???? b??nh lu???n v??o ????n ph??c kh???o ??? l???p ${classroom.name}.`,
        link: `/classrooms/${classroom.id}/tab-review-grade/${gradeReviewId}`,
        userId: student.id,
      }),
    )

    await this.socketIoService.sendNotification(student.id, notification)
  }
  async notifyNewCommentToTeachers(
    classroomId: string,
    user: User,
    gradeReviewId: number,
    content: string,
  ) {
    const classroom = await this.classroomRepository.findById(classroomId)

    const teachers = await this.userClassroomRepository.find({
      where: {
        classroomId: classroom.id,
        userRole: ClassroomRole.TEACHER,
      },
    })
    const notifications: Notification[] = []

    for (const teacher of teachers) {
      if (teacher.userId === user.id) {
        continue
      }
      const notification = new Notification({
        content: content,
        link: `/classrooms/${classroom.id}/tab-review-grade/${gradeReviewId}`,
        userId: teacher.userId,
      })
      notifications.push(notification)
    }
    if (user.id !== classroom.hostId) {
      // for host
      const notificationForhost = new Notification({
        content: content,
        link: `/classrooms/${classroom.id}/tab-review-grade/${gradeReviewId}`,
        userId: classroom.hostId,
      })
      notifications.push(notificationForhost)
    }
    const notificationsResponse = await this.notificationRepository.createAll(notifications)
    for (const notification of notificationsResponse) {
      await this.socketIoService.sendNotification(notification.userId, notification)
    }
  }

  @post('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments/{commentId}')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(204, {
    description: 'Update a comment on a grade review',
    content: { 'application/json': { schema: getModelSchemaRef(CommentOnReview) } },
  })
  async updateById(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @param.path.number('commentId') commentId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CommentOnReview, {
            partial: true,
          }),
        },
      },
    })
    commentOnReviewRequestBody: CommentOnReview,
  ): Promise<CommentOnReview> {
    const getUser = await this.getCurrentUser()

    // check if user owns that grade review or user is teacher or host
    await this.validateGradeReviewRole(gradeReviewId, classroomId, getUser.id)

    const comment = await this.commentOnReviewRepository.findOne({
      where: {
        gradeReviewId: gradeReviewId,
        id: commentId,
      },
    })
    if (!comment) throw new HttpErrors['404']('Kh??ng t??m th???y b??nh lu???n.')
    Object.assign(comment, commentOnReviewRequestBody)
    return this.commentOnReviewRepository.save(comment)
  }

  @get('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Find all CommentOnReview model instances by classroom id',
    content: {
      'application/json': {
        schema: getModelSchemaRef(CommentOnReview, { includeRelations: true }),
      },
    },
  })
  async findByGradeReview(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
  ): Promise<CommentOnReview[]> {
    const getUser = await this.getCurrentUser()

    await this.validateGradeReviewRole(gradeReviewId, classroomId, getUser.id)

    const userClassroom = (await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
    })) as UserClassroomWithRelations

    const classroom: Classroom = await this.classroomRepository.findById(classroomId)
    const user = await this.userRepository.findById(getUser.id)
    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
        classroomId: classroomId,
      },
    })
    if (!gradeReview) throw new HttpErrors['404']('Kh??ng t??m th???y ????n ph??c kh???o.')

    if (
      classroom.hostId === getUser.id ||
      userClassroom.userRole === ClassroomRole.TEACHER ||
      gradeReview.studentId === user.studentId
    ) {
      return this.commentOnReviewRepository.find({
        where: {
          gradeReviewId: gradeReviewId,
        },
        include: [
          {
            relation: 'user',
            scope: {
              fields: ['id', 'fullname', 'avatar', 'studentId'],
            },
          },
        ],
        order: ['createdAt ASC'],
      })
    } else {
      throw new NoPermissionError()
    }
  }

  /**
   * check if user owns this grade review or user is teacher or host
   * @param gradeReview
   * @param userClassroom
   * @param userId
   */
  async validateGradeReviewRole(gradeReviewId: number, classroomId: string, userId: number) {
    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
      },
    })
    if (!gradeReview) throw new GradeReviewNotFoundError()
    // if (gradeReview.studentId !==)

    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: userId,
      },
    })
    const classroom = await this.classroomRepository.findById(classroomId)
    const user = await this.userRepository.findById(userId)
    if (!userClassroom && classroom.hostId !== userId)
      throw new HttpErrors['404']('Kh??ng t??m th???y sinh vi??n.')
    if (userClassroom && userClassroom.userRole === ClassroomRole.STUDENT && !user.studentId)
      throw new StudentIdRequiredError()

    if (
      classroom.hostId !== userId &&
      gradeReview.studentId !== user.studentId &&
      userClassroom?.userRole !== ClassroomRole.TEACHER
    ) {
      throw new NoPermissionError()
    }
  }
}
