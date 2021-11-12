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
    @param.path.number('classroomId') classroomId: number,
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

    console.log(
      '(!student || student.userId !== getUser.id)',
      !student || student.userId !== getUser.id,
    )
    // check if the user uses this route is not host or teacher or own this userid
    if (!isTeacher && !isHost && (!student || student.userId !== getUser.id)) {
      throw new HttpErrors.Unauthorized('You are not allowed to do this.')
    }
    if (!student) throw new HttpErrors.NotFound('Student not found from this classroom')

    const isStudentIdExisted = await this.userClassroomRepository.findOne({
      where: {
        studentId: body.studentId,
        classroomId: classroom.id,
        userId: { neq: getUser.id },
      },
    })
    if (isStudentIdExisted) throw new HttpErrors['400']('Student ID already exists')

    student.studentId = body.studentId
    await this.userClassroomRepository.save(student)
  }
}
