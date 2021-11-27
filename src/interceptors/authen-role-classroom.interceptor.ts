import {
  Getter,
  inject,
  /* inject, */
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { RestBindings, Request, HttpErrors } from '@loopback/rest'
import { repository } from '@loopback/repository'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { ClassroomRole } from '../constants/classroom-role'

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 *
 * To check if current user is teacher or host
 */
@injectable({ tags: { key: AuthenRoleClassroomInterceptor.BINDING_KEY } })
export class AuthenRoleClassroomInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${AuthenRoleClassroomInterceptor.name}`

  constructor(
    @inject(RestBindings.Http.REQUEST) private request: Request,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this)
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    try {
      // Add pre-invocation logic here
      const  id  = invocationCtx.args[0]  // classroomid is the first arg from invocationCtx
      const getUser = await this.getCurrentUser()
      const result = await next()

      const classroom = await this.classroomRepository.findOne({
        where: {
          id: id,
        },
      })
      if (!classroom) throw new HttpErrors['404']('Không tìm thấy lớp học.')

      const isTeacher = await this.userClassroomRepository.findOne({
        where: {
          userId: getUser.id,
          classroomId: classroom.id,
          userRole: ClassroomRole.TEACHER,
        },
      })

      if (classroom.hostId !== getUser.id && !isTeacher) {
        throw new HttpErrors.Forbidden('Bạn không có quyền thực hiện hành động này.')
      }
      // Add post-invocation logic here
      return result
    } catch (err) {
      // Add error handling logic here
      console.log(err)
      throw err
    }
  }
}
