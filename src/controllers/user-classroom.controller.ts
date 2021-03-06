import { authenticate } from '@loopback/authentication'
import { UserServiceBindings } from '@loopback/authentication-jwt'
import { Getter, inject, intercept } from '@loopback/core'
import { repository } from '@loopback/repository'
import {
  post,
  param,
  getModelSchemaRef,
  requestBody,
  response,
  HttpErrors,
  get,
} from '@loopback/rest'
import { Classroom, UpdateStudentIdRequest } from '../models'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { MyUserService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { ClassroomRole } from '../constants/role'
import { AuthenRoleClassroomInterceptor } from '../interceptors'
import { CheckJoinClassroomInterceptor } from '../interceptors/'
import { checkUniqueStudentId } from '../common/helpers'
import { NoPermissionError } from '../common/error-hanlder'
export class UserClassroomController {
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
  ) {}

  @authenticate('jwt')
  @post('/classrooms/{id}/users/{userId}/')
  @response(204, {
    description: 'Student ID changed successfully',
  })
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  async changeStudentInfo(
    @param.path.string('id') classroomId: string,
    @param.path.number('userId') userId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdateStudentIdRequest, {
            partial: true,
          }),
        },
      },
    })
    body: UpdateStudentIdRequest,
  ): Promise<void> {
    // user who calls this api
    const getUser = await this.getCurrentUser()

    const teacher = await this.userClassroomRepository.count({
      where: {
        userId: getUser.id,
        classroomId: classroomId,
        userRole: ClassroomRole.TEACHER,
      },
    })

    // Check if current user is not a teacher or not the one wants to change self id
    if (!teacher.count && getUser.id !== userId) {
      throw new NoPermissionError()
    }

    // Check if teachers has the right to change student's id in their classroom
    const student = await this.userClassroomRepository.count({
      where: {
        userId: userId,
        classroomId: classroomId,
        userRole: ClassroomRole.STUDENT,
      },
    })
    if (!student.count) throw new HttpErrors.NotFound('Kh??ng t??m th???y sinh vi??n trong l???p h???c n??y.')
    const user = await this.userRepository.findById(userId)

    const isStudentIdUnique = await checkUniqueStudentId(user, body.studentId, this.userRepository)

    if (!isStudentIdUnique) throw new HttpErrors['400']('M?? s??? sinh vi??n ???? t???n t???i!')

    user.studentId = body.studentId
    await this.userRepository.save(user)
  }

  @authenticate('jwt')
  @get('/join-by-code/{code}')
  @response(200, {
    description: 'Join a classroom by code',
  })
  async joinClassroomByCode(@param.path.string('code') code: string): Promise<Classroom> {
    const getUser = await this.getCurrentUser()
    const classroom = await this.classroomRepository.findOne({
      where: {
        code: code,
      },
      include: ['host'],
    })
    if (!classroom) throw new HttpErrors['404']('Kh??ng t??m th???y l???p h???c.')
    const isJoined = await this.userClassroomRepository.count({
      userId: getUser.id,
      classroomId: classroom.id,
    })

    if (isJoined.count) throw new HttpErrors['400']('B???n ???? tham gia l???p n??y!')

    await this.userClassroomRepository.create({
      classroomId: classroom.id,
      userId: getUser.id,
      userRole: ClassroomRole.STUDENT,
    })

    return classroom
  }

  @authenticate('jwt')
  @post('/classrooms/{classroomId}/leave')
  @response(204, {
    description: 'User leaves a clasroom',
  })
  async leaveClassroom(@param.path.string('classroomId') classroomId: string): Promise<void> {
    const getUser = await this.getCurrentUser()
    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
    })
    if (!userClassroom) throw new NoPermissionError()
    const classroom = await this.classroomRepository.findById(classroomId)

    if (classroom.hostId === getUser.id)
      throw new HttpErrors['400']('Qu???n tr??? vi??n kh??ng th??? r???i kh???i ph??ng h???c.')

    await this.userClassroomRepository.deleteById(userClassroom.id)
  }

  @authenticate('jwt')
  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{classroomId}/users/{userId}/kick')
  @response(204, {
    description: 'Kick out one user',
  })
  async kickUser(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('userId') userId: number,
  ): Promise<void> {
    const classroom = await this.classroomRepository.findById(classroomId)

    // user who calls this api
    const getUser = await this.getCurrentUser()
    if (getUser.id === userId) throw new HttpErrors['400']('Kh??ng th??? t??? m???i m??nh ra kh???i l???p.')

    // user that is kicked
    const user = await this.userClassroomRepository.findOne({
      where: {
        userId: userId,
        classroomId: classroomId,
      },
    })
    if (!user) throw new HttpErrors.NotFound('Kh??ng t??m th???y th??nh vi??n n??y.')

    const isHost = classroom.hostId === getUser.id

    if (user.userRole === ClassroomRole.TEACHER) {
      if (!isHost) throw new NoPermissionError()
    }
    await this.userClassroomRepository.deleteById(user.id)
  }
}
