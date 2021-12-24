/* eslint-disable @typescript-eslint/no-floating-promises */
import { inject } from '@loopback/core'
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
import { CommentOnReview, Notification } from '../models'
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
import { authenticate } from '@loopback/authentication'
import { SocketIoService } from '../services'

@authenticate('jwt')
export class NotificationController {
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

  @post('/notifications')
  @response(200, {
    description: 'Create a notification',
    content: { 'application/json': { schema: getModelSchemaRef(CommentOnReview) } },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Notification, {
            partial: true,
            exclude: ['id', 'createdAt', 'updatedAt', 'userId'],
          }),
        },
      },
    })
    notificationRequestBody: Omit<Notification, 'id'>,
  ): Promise<Notification> {
    const user = await this.getCurrentUser()

    const notification = await this.notificationRepository.create(notificationRequestBody)

    this.socketIoService.sendNotification(user.id, notification)
    return notification
  }

  @get('/notifications')
  @response(200, {
    description: 'Find all notifications of a user',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Notification, { includeRelations: true }),
        },
      },
    },
  })
  async find(@param.filter(Notification) filter: Filter<Notification>): Promise<Notification[]> {
    filter = filter ?? {}
    const getUser = await this.getCurrentUser()
    filter.where = { ...filter.where, userId: getUser.id }
    filter.order = ['createdAt DESC']
    return this.notificationRepository.find(filter)
  }

  @get('/notifications/{id}/mark-read')
  @response(200, {
    description: 'Mark notification read',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Notification),
      },
    },
  })
  async markAsRead(@param.path.number('id') id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!notification) throw new HttpErrors.NotFound('Không tìm thấy yêu cầu.')
    if (!notification.isRead) {
      notification.isRead = true

      return this.notificationRepository.save(notification)
    }
    return notification
  }

  @get('/notifications/mark-all-read')
  @response(200, {
    description: 'Mark notification read',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Notification),
      },
    },
  })
  async markAllAsRead(): Promise<Notification[]> {
    const getUser = await this.getCurrentUser()

    await this.notificationRepository.updateAll(
      {
        isRead: true,
      },
      {
        userId: getUser.id,
      },
    )
    const notifications = await this.notificationRepository.find({
      where: {
        userId: getUser.id,
      },
    })
    return notifications
  }
}
