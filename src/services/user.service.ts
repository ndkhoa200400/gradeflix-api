import { UserService } from '@loopback/authentication'
import { JWTService, TokenServiceBindings } from '@loopback/authentication-jwt'
import { inject } from '@loopback/core'
import { repository } from '@loopback/repository'
import { HttpErrors } from '@loopback/rest'
import { PasswordHasherBindings } from '../keys'
import { LoginReq, LoginRes, UpdatePasswordRequest, User } from '../models'
import { UserRepository } from '../repositories'
import { BcryptHasher } from './hash-password.service'
import { securityId, UserProfile } from '@loopback/security'
import { genSalt, hash } from 'bcryptjs'
import { verify } from '../common/helpers'
import { NoPermissionError } from '../common/error-hanlder'
import { UserRole } from '../constants/role'
export class MyUserService implements UserService<User, LoginReq> {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,

    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    public hasher: BcryptHasher,

    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JWTService,
  ) {}
  async verifyCredentials(credentials: LoginReq): Promise<User> {
    // Find user in DB
    const foundUser = await this.userRepository.findOne({
      where: {
        email: credentials.email,
      },
    })
    if (!foundUser) {
      throw new HttpErrors.NotFound('User not found')
    }
    const { password = '' } = foundUser

    if (!password) throw new NoPermissionError('Bạn không có quyền truy cập')
    const passwordMatched = await this.hasher.comparePassword(credentials.password!, password)
    if (!passwordMatched) {
      throw new HttpErrors.Unauthorized('Mật khẩu không chính xác.')
    }
    return foundUser
  }

  // Add information into token
  convertToUserProfile(user: User): UserProfile {
    const { email, id } = user
    return { [securityId]: user.id.toString(), email, id }
  }

  async register(userData: User) {
    userData.password = await hash(userData.password, await genSalt())
    if (userData.role === UserRole.ADMIN) {
      throw new NoPermissionError('Không thể tạo tài khoản Admin.')
    }
    const user = await this.userRepository.create(userData)
    const userProfile = this.convertToUserProfile(user)
    const token = await this.jwtService.generateToken(userProfile)
    return new LoginRes({ ...user, token })
  }

  async changePassword(userId: number, data: UpdatePasswordRequest) {
    const user = await this.userRepository.findById(userId)
    if (!user.password)
      throw new NoPermissionError('Bạn không thể đổi mật khẩu với tài khoản đăng nhập qua Google.')
    // validate old password
    const passwordMatched = await this.hasher.comparePassword(data.oldPassword!, user.password)
    if (!passwordMatched) throw new HttpErrors['401']('Mật khẩu cũ không đúng. Vui lòng nhập lại')

    user.password = await hash(data.newPassword, await genSalt())
    await this.userRepository.save(user)

    const userProfile = this.convertToUserProfile(user)
    const token = await this.jwtService.generateToken(userProfile)

    return token
  }

  async resetPassword(userId: number, newPassword: string) {
    const user = await this.userRepository.findById(userId)
    if (!user.password)
      throw new NoPermissionError('Bạn không thể đổi mật khẩu với tài khoản đăng nhập qua Google.')

    user.password = await hash(newPassword, await genSalt())
    await this.userRepository.save(user)

    const userProfile = this.convertToUserProfile(user)
    const token = await this.jwtService.generateToken(userProfile)

    return token
  }

  async verifyGoogleToken(token: string): Promise<LoginRes> {
    const payload = await verify(token)
    let user = await this.userRepository.findOne({
      where: {
        email: payload.email,
      },
    })
    if (!user) {
      user = await this.userRepository.create({
        email: payload.email,
        avatar: payload.picture,
        fullname: `${payload.family_name} ${payload.given_name}`,
        googleId: payload.sub,
      })
    } else {
      if (!user.googleId) {
        user.googleId = payload.sub
        user = await this.userRepository.save(user)
      }
    }
    const userProfile = this.convertToUserProfile(user)
    const genToken = await this.jwtService.generateToken(userProfile)

    return new LoginRes({ ...user, token: genToken })
  }
}
