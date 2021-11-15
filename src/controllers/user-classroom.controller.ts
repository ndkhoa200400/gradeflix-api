import { authenticate } from '@loopback/authentication'
import { UserServiceBindings } from '@loopback/authentication-jwt'
import { Getter, inject } from '@loopback/core'
import { repository } from '@loopback/repository'
import { post, param, getModelSchemaRef, requestBody, response, HttpErrors } from '@loopback/rest'
import { UpdateStudentidRequest } from '../models'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { MyUserService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { ClassroomRole } from '../constants/classroom-role'
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
  @post('/classrooms/{classroomId}/users/{userId}/')
  @response(204, {
    description: 'Student ID changes successfully',
  })
  async changeStudentInfo(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('userId') userId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdateStudentidRequest, {
            partial: true,
          }),
        },
      },
    })
    body: UpdateStudentidRequest,
  ): Promise<void> {
    const classroom = await this.classroomRepository.findById(classroomId)

    // user who calls this api
    const getUser = await this.getCurrentUser()

    const isTeacher = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        userRole: ClassroomRole.TEACHER,
        classroomId: classroomId,
      },
    })
    // student that is changed student id
    const student = await this.userClassroomRepository.findOne({
      where: {
        userId: userId,
        classroomId: classroomId,
        userRole: ClassroomRole.STUDENT,
      },
    })

    const isHost = classroom.hostId === getUser.id

    // check if the user uses this route is not host or teacher or own this userid
    if (!isTeacher && !isHost && (!student || student.userId !== getUser.id)) {
      throw new HttpErrors.Forbidden('Bạn không có quyền thay đổi thông tin.')
    }
    if (!student) throw new HttpErrors.NotFound('Không tìm thấy sinh viên trong lớp học này.')

    const isStudentIdExisted = await this.userClassroomRepository.findOne({
      where: {
        studentId: body.studentId,
        classroomId: classroom.id,
        userId: { neq: getUser.id },
      },
    })
    if (isStudentIdExisted) throw new HttpErrors['400']('Mã số sinh viên đã tồn tại!')

    student.studentId = body.studentId
    await this.userClassroomRepository.save(student)
  }

  @authenticate('jwt')
  @post('/classrooms/{classroomId}/users/leave')
  @response(204, {
    description: 'User leaves clasroom',
  })
  async leaveClassroom(@param.path.string('classroomId') classroomId: string): Promise<void> {
    const getUser = await this.getCurrentUser()
    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
    })
    if (!userClassroom) throw new HttpErrors.Forbidden('Bạn không có quyền truy cập')
    const classroom = await this.classroomRepository.findById(classroomId)

    if (classroom.hostId === getUser.id)
      throw new HttpErrors['400']('Quản trị viên không thể rời khỏi phòng học.')

    await this.userClassroomRepository.deleteById(userClassroom.id)
  }

  @authenticate('jwt')
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
    if (getUser.id === userId) throw new HttpErrors['400']('Không thể tự mời mình ra khỏi lớp.')

    const isTeacher = await this.userClassroomRepository.findOne({
      where: {
        userId: getUser.id,
        userRole: ClassroomRole.TEACHER,
        classroomId: classroomId,
      },
    })

    // user that is kicked
    const user = await this.userClassroomRepository.findOne({
      where: {
        userId: userId,
        classroomId: classroomId,
      },
    })

    const isHost = classroom.hostId === getUser.id

    // check if the user uses this route is not host or teacher
    if (!isTeacher && !isHost) {
      throw new HttpErrors.Forbidden('Bạn không có quyền thực hiện hành động này.')
    }
    if (!user) throw new HttpErrors.NotFound('Không tìm thấy thành viên này.')
    if (user.userRole === ClassroomRole.TEACHER) {
      if (!isHost) throw new HttpErrors.Forbidden('Bạn không có quyền thực hiện hành động này.')
    }
    await this.userClassroomRepository.deleteById(user.id)
  }
}
