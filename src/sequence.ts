import { Getter, inject } from '@loopback/context'
import {
  AuthenticateFn,
  AuthenticationBindings,
  AUTHENTICATION_STRATEGY_NOT_FOUND,
  USER_PROFILE_NOT_FOUND,
} from '@loopback/authentication'
import {
  FindRoute,
  HttpErrors,
  InvokeMethod,
  InvokeMiddleware,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler,
} from '@loopback/rest'
import { repository } from '@loopback/repository'
import { UserRepository } from './repositories'
import { SecurityBindings, UserProfile } from '@loopback/security'
import { TokenServiceBindings, JWTService } from '@loopback/authentication-jwt'

const SequenceActions = RestBindings.SequenceActions

export class MySequence implements SequenceHandler {
  /**
   * Optional invoker for registered middleware in a chain.
   * To be injected via SequenceActions.INVOKE_MIDDLEWARE.
   */
  @inject(SequenceActions.INVOKE_MIDDLEWARE, { optional: true })
  protected invokeMiddleware: InvokeMiddleware = () => false

  constructor(
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
    @inject(AuthenticationBindings.AUTH_ACTION)
    protected authenticateRequest: AuthenticateFn,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JWTService,
  ) {}

  async handle(context: RequestContext) {
    try {
      const { request, response } = context
      const finished = await this.invokeMiddleware(context)
      if (finished) return

      let token
      const { authorization } = request.headers

      if (authorization) {
        token = authorization.split('Bearer ')[1]
        if (token && token !== 'undefined') {
          const userProfile = await this.jwtService.verifyToken(token)
          const user = await this.userRepository.findOne({
            where: {
              id: userProfile.id,
            },
          })
          if (user && !user.active) {
            throw new HttpErrors['403'](
              'Tài khoản của bạn đã bị khóa. Liên hệ với quản trị viên để biết thêm thông tin.',
            )
          }
        }
      }

      const route = this.findRoute(request)
      await this.authenticateRequest(request)
      const args = await this.parseParams(request, route)
      const result = await this.invoke(route, args)

      this.send(response, result)
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as unknown as any
      console.log(err)
      if (
        err.code === AUTHENTICATION_STRATEGY_NOT_FOUND ||
        err.code === USER_PROFILE_NOT_FOUND ||
        err.name === 'TokenExpiredError'
      ) {
        Object.assign(err, { statusCode: 401 /* Unauthorized */ })
      }
      if (err.code === '23505') {
        Object.assign(err, { statusCode: 400 /* Unauthorized */ })
      }
      this.reject(context, err as Error)
    }
  }
}
