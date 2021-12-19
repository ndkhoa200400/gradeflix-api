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
import { repository } from '@loopback/repository'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { NoPermissionError } from '../common/error-hanlder'
import { UserRole } from '../constants/role'
import { HttpErrors } from '@loopback/rest'

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 *
 * To check if current user is teacher or host
 */
@injectable({ tags: { key: AuthenAdminRoleInterceptor.BINDING_KEY } })
export class AuthenAdminRoleInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${AuthenAdminRoleInterceptor.name}`

  constructor(
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
      const getUser = await this.getCurrentUser()

      const user = await this.userRepository.findOne({
        where: {
          id: getUser.id,
        },
      })
      if (!user) throw new HttpErrors['404']('Không tìm thấy người dùng này.')

      if (user.role !== UserRole.ADMIN) {
        throw new NoPermissionError()
      }
      // Add post-invocation logic here
      const result = await next()
      return result
    } catch (err) {
      // Add error handling logic here
      console.log(err)
      throw err
    }
  }
}
