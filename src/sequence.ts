import { inject } from '@loopback/context'
import {
  AuthenticateFn,
  AuthenticationBindings,
  AUTHENTICATION_STRATEGY_NOT_FOUND,
  USER_PROFILE_NOT_FOUND,
} from '@loopback/authentication'
import {
  FindRoute,
  InvokeMethod,
  InvokeMiddleware,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler,
} from '@loopback/rest'

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
  ) {}

  async handle(context: RequestContext) {
    try {
      const { request, response } = context
      const finished = await this.invokeMiddleware(context)
      if (finished) return
      const route = this.findRoute(request)
      await this.authenticateRequest(request)
      const args = await this.parseParams(request, route)
      const result = await this.invoke(route, args)
      this.send(response, result)
    } catch (err) {
      console.log(err)
      if (
        err.code === AUTHENTICATION_STRATEGY_NOT_FOUND ||
        err.code === USER_PROFILE_NOT_FOUND ||
        err.name === 'TokenExpiredError'
      ) {
        Object.assign(err, { statusCode: 401 /* Unauthorized */ })
      }
      if (err.code ==="23505")
      {
        Object.assign(err, { statusCode: 400 /* Unauthorized */ })
      }
      this.reject(context, err as Error)
    }
  }
}
