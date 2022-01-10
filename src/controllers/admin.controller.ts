import { authenticate } from '@loopback/authentication'
import { inject, intercept } from '@loopback/core'
import { Count, CountSchema, Filter, repository } from '@loopback/repository'
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
  ClassroomWithUsersResponse,
  Notification,
  User,
  UserClassroom,
  UserWithRole,
} from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  NotificationRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { AuthenAdminRoleInterceptor } from '../interceptors/authen-admin-role.interceptor'
import { ClassroomRole, UserRole } from '../constants/role'
import { MyUserService, SocketIoService } from '../services'
import { PaginatedRequestDto, PaginatedResponse } from '../common/dtos'
import { findAll } from '../common/helpers'
import { UserServiceBindings } from '@loopback/authentication-jwt'
@authenticate('jwt')
@intercept(AuthenAdminRoleInterceptor.BINDING_KEY)
export class AdminController {
  constructor(
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @inject('services.socketio')
    public socketIoService: SocketIoService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
  ) {}

  // Classroom management
  @get('admin/classrooms')
  @response(200, {
    description: 'Array of Classroom model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Classroom, { includeRelations: true }),
        },
      },
    },
  })
  async findClassrooms(
    @param.filter(Classroom) filter: Filter<Classroom>,
    @param.query.number('pageSize') pageSize: number,
    @param.query.number('pageIndex') pageIndex: number,
  ): Promise<PaginatedResponse<ClassroomWithUsersResponse>> {
    filter = filter ?? ({} as Filter<Classroom>)
    const count = await this.classroomRepository.count(filter.where)
    const total = count.count
    pageSize = pageSize ?? total
    pageIndex = pageIndex ?? 1
    if (total <= 0) {
      return new PaginatedResponse<ClassroomWithUsersResponse>([], pageIndex, pageSize, total)
    }

    const paginated = new PaginatedRequestDto({
      pageSize,
      pageIndex,
    })

    filter.limit = pageSize
    filter.skip = paginated.skip
    const classrooms = await this.classroomRepository.find(filter)

    const classroomsWithUsers: ClassroomWithUsersResponse[] = []
    for (const classroom of classrooms) {
      const temp = await this.getClassroomWithUsers(classroom)
      classroomsWithUsers.push(temp)
    }

    return new PaginatedResponse<ClassroomWithUsersResponse>(
      classroomsWithUsers,
      pageIndex,
      pageSize,
      total,
    )
  }

  @get('admin/classrooms/count')
  @response(200, {
    description: 'Array of Classroom model instances',
    content: {
      'application/json': {
        description: 'Classroom model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async countClassroom(): Promise<Count> {
    const count = await this.classroomRepository.count()
    return count
  }

  @get('admin/classrooms/{id}')
  @response(200, {
    description: 'Classroom model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Classroom, { includeRelations: true }),
      },
    },
  })
  async findClassroomById(
    @param.path.string('id') id: string,
  ): Promise<ClassroomWithUsersResponse> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })

    if (!classroom) throw new HttpErrors.NotFound(`Không tìm thấy lớp học ${id}.`)
    return this.getClassroomWithUsers(classroom)
  }

  @post('admin/classrooms/{id}')
  @response(200, {
    description: 'Update information of classroom',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Classroom, { includeRelations: true }),
      },
    },
  })
  async updateClassroomById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Classroom, {
            partial: true,
          }),
        },
      },
    })
    classroomRequestBody: Classroom,
  ): Promise<Classroom> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!classroom) throw new HttpErrors.NotFound(`Không tìm thấy lớp học ${id}.`)
    Object.assign(classroom, classroomRequestBody)
    if (classroomRequestBody.active === false) {
      const userClassrooms = await this.userClassroomRepository.find({
        where: {
          classroomId: classroom.id,
        },
      })
      const userIds = userClassrooms.map(item => item.userId)
      userIds.push(classroom.hostId)
      const notifications: Notification[] = []
      for (const userId of userIds) {
        notifications.push(
          new Notification({
            content: `Lớp ${classroom.name} đã bị khóa`,
            link: '/',
            userId: userId,
          }),
        )
      }
      await this.notificationRepository.createAll(notifications)
      await this.socketIoService.lockClassroom(userIds, notifications, classroom.id)
    }
    return this.classroomRepository.save(classroom)
  }

  @get('admin/classrooms/{id}/users')
  @response(200, {
    description: 'Classroom model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ClassroomWithUsersResponse, { includeRelations: true }),
      },
    },
  })
  async findUsersOfClassroom(
    @param.path.string('id') id: string,
    @param.query.number('pageSize') pageSize: number,
    @param.query.number('pageIndex') pageIndex: number,
  ): Promise<PaginatedResponse<UserWithRole>> {
    const filter: Filter<UserClassroom> = {}
    filter.where = { classroomId: id }
    filter.include = ['user']
    const count = await this.userClassroomRepository.count(filter.where)
    const total = count.count + 1

    pageSize = pageSize ?? total
    pageIndex = pageIndex ?? 1
    const paginated = new PaginatedRequestDto({
      pageSize,
      pageIndex,
    })

    filter.limit = pageSize
    filter.skip = paginated.skip
    const classroom = await this.classroomRepository.findById(id)

    const userClassrooms = await this.userClassroomRepository.find(filter)

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

    return new PaginatedResponse<UserWithRole>(usersInClassroom, pageIndex, pageSize, total)
    // return classroom
  }

  // User Management
  @get('admin/users')
  @response(200, {
    description: 'Array of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, { includeRelations: true }),
        },
      },
    },
  })
  async findUsers(
    @param.query.number('pageSize') pageSize: number,
    @param.query.number('pageIndex') pageIndex: number,
    @param.filter(User) filter: Filter<User>,
  ): Promise<PaginatedResponse<User>> {
    filter = filter ?? {}
    return findAll(filter, this.userRepository, pageSize, pageIndex)
  }

  @get('admin/users/count')
  @response(200, {
    description: 'Users count',
    content: {
      'application/json': {
        description: 'Classroom model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async countUser(): Promise<Count> {
    const count = await this.userRepository.count()
    return count
  }

  @get('admin/users/{id}')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async findUserById(@param.path.number('id') id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!user) throw new HttpErrors.NotFound(`Không tìm thấy người dùng ${id}.`)
    return user
  }

  @post('admin/users/{id}')
  @response(200, {
    description: 'Update information of classroom',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async updateUserById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            partial: true,
          }),
        },
      },
    })
    userRequestBody: User,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!user) throw new HttpErrors.NotFound(`Không tìm thấy người dùng ${id}.`)
    if (userRequestBody.studentId) {
      const userWithStudentId = await this.userRepository.findOne({
        where: {
          studentId: userRequestBody.studentId,
        },
      })
      if (userWithStudentId) {
        throw new HttpErrors.BadRequest(`Mã số sinh viên đã được dùng bởi #${userWithStudentId.id}`)
      }
    }
    Object.assign(user, userRequestBody)
    if (userRequestBody.active === false) {
      await this.socketIoService.lockAccount(user.id)
    }
    return this.userRepository.save(user)
  }

  @post('admin/accounts/')
  @response(200, {
    description: 'Update information of classroom',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {
          includeRelations: true,
          exclude: ['createdAt', 'updatedAt', 'activated', 'googleId', 'id', 'studentId', 'role'],
        }),
      },
    },
  })
  async createAdminAccount(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            partial: true,
          }),
        },
      },
    })
    userRequestBody: User,
  ): Promise<User> {
    userRequestBody.role = UserRole.ADMIN
    userRequestBody.activated = true
    const user = await this.userService.register(userRequestBody)
    return user
  }

  @get('admin/accounts')
  @response(200, {
    description: 'Find all admin accounts',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async getAdminAccounts(
    @param.query.number('pageSize') pageSize: number,
    @param.query.number('pageIndex') pageIndex: number,
    @param.filter(User) filter: Filter<User>,
  ): Promise<PaginatedResponse<User>> {
    filter = filter ?? {}
    filter.where = {
      ...filter,
      role: UserRole.ADMIN,
    }
    return findAll(filter, this.userRepository, pageSize, pageIndex)
  }

  // Notification
  @post('admin/notifications/users/{id}')
  @response(200, {
    description: 'Update information of classroom',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Notification),
      },
    },
  })
  async sendNotification(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Notification, {
            partial: true,
          }),
        },
      },
    })
    notificationRequestBody: Notification,
  ): Promise<Notification> {
    const user = await this.userRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!user) throw new HttpErrors.NotFound(`Không tìm thấy người dùng ${id}.`)
    const notification = await this.notificationRepository.create({
      ...notificationRequestBody,
      userId: user.id,
    })
    await this.socketIoService.sendNotification(user.id, notification)

    return notification
  }

  async getClassroomWithUsers(classroom: Classroom): Promise<ClassroomWithUsersResponse> {
    const userClassrooms = await this.userClassroomRepository.find({
      include: ['user'],
      where: {
        classroomId: classroom.id,
      },
    })

    const users: UserWithRole[] = []

    for (const userClassroom of userClassrooms) {
      const user = userClassroom.user
      const role = userClassroom.userRole

      const temp = new UserWithRole({
        ...user,
        userRole: role,
      })
      users.push(temp)
    }

    const host = await this.userRepository.findById(classroom.hostId)

    users.push(
      new UserWithRole({
        ...host,
        userRole: ClassroomRole.HOST,
      }),
    )
    return new ClassroomWithUsersResponse({
      ...classroom,
      users: users,
    })
  }
}
