import { authenticate } from '@loopback/authentication'
import { Getter, inject, intercept } from '@loopback/core'
import { Count, CountSchema, repository } from '@loopback/repository'
import {
  post,
  param,
  get,
  getModelSchemaRef,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest'
import { Classroom, GetOneClassroomResponse, User, UserWithRole } from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { AuthenAdminRoleInterceptor } from '../interceptors/authen-admin-role.interceptor'
import { ClassroomRole } from '../constants/role'
@authenticate('jwt')
@intercept(AuthenAdminRoleInterceptor.BINDING_KEY)
export class AdmminController {
  constructor(
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
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
  async findClassrooms(): Promise<Classroom[]> {
    const classrooms = await this.classroomRepository.find()
    return classrooms
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
  async findClassroomById(@param.path.string('id') id: string): Promise<Classroom> {
    const classroom = await this.classroomRepository.findOne({
      where: {
        id: id,
      },
    })
    if (!classroom) throw new HttpErrors.NotFound(`Không tìm thấy lớp học ${id}.`)
    return classroom
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
    return this.classroomRepository.save(classroom)
  }

  @get('admin/classrooms/{id}/users')
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
      })
      usersInClassroom.push(temp)
    }

    return usersInClassroom
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
  async findUsers(): Promise<User[]> {
    const users = await this.userRepository.find()
    return users
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
    @param.path.string('id') id: string,
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
    return this.userRepository.save(user)
  }
}
