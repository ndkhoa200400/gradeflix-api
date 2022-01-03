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
import {
  LoginReq,
  LoginRes,
  PatchUserRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
  User,
} from '../models'
import { EmailManager, MyUserService, IEmailRequest } from '../services'
import { UserRepository } from '../repositories'
import dayjs from 'dayjs'
import { checkUniqueStudentId, hashSha256 } from '../common/helpers'
import { EmailManagerBindings } from '../keys'

export class UserController {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @repository(UserRepository) protected userRepository: UserRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(EmailManagerBindings.SEND_MAIL)
    public emailManager: EmailManager,
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
            exclude: ['id', 'createdAt', 'updatedAt'],
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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendActivationLink(user)
    return user
  }

  @authenticate('jwt')
  @get('/users/activation-request')
  @response(200, {
    description: 'Users request activation link',
  })
  async requestActivationLink(): Promise<void> {
    const getUser = await this.getCurrentUser()

    const user = await this.userRepository.findById(getUser.id)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendActivationLink(user)
  }

  async sendActivationLink(user: User) {
    const token = hashSha256(`${user.email}|${user.id}`)

    const webLink = process.env.WEB_LINK + `/activate?token=${token}&email=${user.email}`
    const emailData: IEmailRequest = {
      subject: 'Kích hoạt tài khoản',
      from: 'gradeflix@gmail.com',
      to: user.email,
      link: webLink,
      template: './src/common/helpers/activate-email.template.html',
      userName: user.fullname ?? user.email,
    }
    try {
      await this.emailManager.sendMail(emailData)
    } catch (error) {
      console.log('error when sending invitation', error)
      throw new HttpErrors['400']('Đã có lỗi xảy ra. Vui lòng thử lại')
    }
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
      const isUnique = await checkUniqueStudentId(user, userBody.studentId, this.userRepository)

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

  @post('/users/reset-password-request')
  @response(204, {
    description: 'User request reseting password',
  })
  async resetPasswordRequest(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ResetPasswordRequest),
        },
      },
    })
    request: ResetPasswordRequest,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        email: request.email,
      },
    })

    if (!user) throw new HttpErrors['404']('Không tìm thấy người dùng này.')
    const token = hashSha256(`${request.email}|${user.id}|${user.password}`)
    const webLink = process.env.WEB_LINK + `/reset-password?token=${token}&email=${user.email}`
    const emailData: IEmailRequest = {
      subject: 'Đặt lại mật khẩu',
      from: 'gradeflix@gmail.com',
      to: user.email,
      link: webLink,
      template: './src/common/helpers/reset-password-email.template.html',
      userName: user.fullname ?? user.email,
    }
    try {
      await this.emailManager.sendMail(emailData)
    } catch (error) {
      console.log('error when sending invitation', error)
      throw new HttpErrors['400']('Đã có lỗi xảy ra. Vui lòng thử lại')
    }
  }

  @post('/users/reset-password')
  @response(204, {
    description: 'User reset password',
  })
  async resetPassword(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ResetPasswordRequest),
        },
      },
    })
    request: ResetPasswordRequest,
    @param.query.string('token') token: string,
  ): Promise<LoginRes> {
    const user = await this.userRepository.findOne({
      where: {
        email: request.email,
      },
    })

    if (!user) throw new HttpErrors['404']('Không tìm thấy người dùng này.')
    const hashed = hashSha256(`${request.email}|${user.id}|${user.password}`)

    if (hashed !== token) {
      throw new HttpErrors['401']('Yêu cầu không đúng. Vui lòng thử lại sau')
    }
    const jwtToken = await this.userService.resetPassword(user.id, request.newPassword as string)

    return new LoginRes({
      ...user,
      token: jwtToken,
    })
  }

  @authenticate('jwt')
  @post('/users/activate')
  @response(200, {
    description: 'Users activate their account',
  })
  async activateAccount(
    @param.query.string('token') token: string,
    @param.query.string('email') email: string,
  ): Promise<User> {
    const getUser = await this.getCurrentUser()
    const user = await this.userRepository.findById(getUser.id)
    if (user.email !== email) throw new HttpErrors['400']('Tài khoản không trùng khớp email.')
    if (user.activated) throw new HttpErrors['403']('Tài khoản đã được kích hoạt.')
    const hashed = hashSha256(`${user.email}|${user.id}`)

    if (token !== hashed) {
      throw new HttpErrors['401']('Yêu cầu không đúng. Vui lòng thử lại')
    }
    user.activated = true
    return this.userRepository.save(user)
  }
}
