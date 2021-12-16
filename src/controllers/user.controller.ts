import { Getter, inject } from '@loopback/core'
import { TokenServiceBindings, UserServiceBindings } from '@loopback/authentication-jwt'
import { authenticate, TokenService } from '@loopback/authentication'
import { SecurityBindings, UserProfile } from '@loopback/security'
import { FilterExcludingWhere, repository } from '@loopback/repository'
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest'
import { LoginReq, LoginRes, PatchUserRequest, UpdatePasswordRequest, User } from '../models'
import { MyUserService } from '../services'
import { UserRepository } from '../repositories'
import dayjs from 'dayjs'
import { checkUniqueStudentId } from '../common/helpers'

export class UserController {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @repository(UserRepository) protected userRepository: UserRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
  ) {}

  @post('/users/login')
  @response(200, {
    description: 'User Login',
    content: { 'application/json': { schema: getModelSchemaRef(LoginRes) } },
  })
  async login(@requestBody(LoginReq) credentials: LoginReq): Promise<LoginRes> {
    // ensure the user exists, and the password is correct
    const user = await this.userService.verifyCredentials(credentials)
    // convert a User object into a UserProfile object (reduced set of properties)
    const userProfile = this.userService.convertToUserProfile(user)

    // create a JSON Web Token based on the user profile
    const token = await this.jwtService.generateToken(userProfile)
    return new LoginRes({ ...user, token })
  }

  @post('/users/register')
  @response(201, {
    description: 'User POST',
    content: { 'application/json': { schema: LoginRes } },
  })
  async register(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            exclude: ['id', 'createdat', 'updatedat'],
          }),
        },
      },
    })
    userBody: User,
  ): Promise<LoginRes> {
    // check day is valid
    if (userBody.birthday) {
      if (!dayjs(userBody.birthday).isValid())
        throw new HttpErrors['400']('Ngày sinh không đúng định dạng!')
    }
    const user = await this.userService.register(userBody)
    return user
  }

  @authenticate('jwt')
  @get('/users/{id}')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(User, { exclude: 'where' }) filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    filter = filter ?? {}

    return this.userRepository.findById(id, filter)
  }

  @post('/users/login-with-google')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async loginWithGoogle(
    @requestBody({
      description: 'User model instance',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          },
        },
      },
    })
    body: {
      token: string
    },
  ): Promise<LoginRes> {
    const res = await this.userService.verifyGoogleToken(body.token)
    return res
  }

  @authenticate('jwt')
  @get('/users/me')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async getMe(): Promise<User> {
    const getUser = await this.getCurrentUser()
    return this.userRepository.findById(getUser.id)
  }

  @authenticate('jwt')
  @post('/users/me')
  @response(200, {
    description: 'User information UPDATE',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, { includeRelations: true }),
      },
    },
  })
  async updateUser(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(PatchUserRequest, { partial: true }),
        },
      },
    })
    userBody: PatchUserRequest,
  ): Promise<User> {
    const getUser = await this.getCurrentUser()
    if (userBody.birthday) {
      if (!dayjs(userBody.birthday).isValid())
        throw new HttpErrors['400']('Ngày sinh không đúng định dạng!')
    }
    const user = await this.userRepository.findById(getUser.id)

    if (userBody.studentId) {
      const isUnique = await checkUniqueStudentId(userBody.studentId, this.userRepository)

      if (!isUnique) throw new HttpErrors['400']('Mã số sinh viên đã tồn tại')
    }

    Object.assign(user, userBody)

    return this.userRepository.save(user)
  }

  @authenticate('jwt')
  @post('/users/me/password')
  @response(204, {
    description: 'User UPDATE Password',
  })
  async updatePassword(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdatePasswordRequest),
        },
      },
    })
    passwordBody: UpdatePasswordRequest,
  ): Promise<{ token: string }> {
    const getUser = await this.getCurrentUser()
    const token = await this.userService.changePassword(getUser.id, passwordBody)
    return { token }
  }
}
