import { UserService } from '@loopback/authentication'
import { JWTService, TokenServiceBindings } from '@loopback/authentication-jwt'
import { inject } from '@loopback/core'
import { repository } from '@loopback/repository'
import { HttpErrors } from '@loopback/rest'
import { PasswordHasherBindings } from '../keys'
import { LoginReq, LoginRes, User, UserLoginSocialRequest } from '../models'
import { UserRepository } from '../repositories'
import { BcryptHasher } from './hash-password.service'
import { securityId, UserProfile } from '@loopback/security'
import { genSalt, hash } from 'bcryptjs'

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

    if (!password) throw new HttpErrors.Forbidden('You are not allowed to use this method')
    const passwordMatched = await this.hasher.comparePassword(credentials.password!, password)
    if (!passwordMatched) {
      throw new HttpErrors.Unauthorized('Password is not valid')
    }
    return foundUser
  }

  // Add information into token
  convertToUserProfile(user: User): UserProfile {
    const { fullname, email, avatar, id } = user
    return { [securityId]: user.id.toString(), fullname, email, avatar, id }
  }

  async register(userData: User) {
    userData.password = await hash(userData.password, await genSalt())
    const user = await this.userRepository.create(userData)
    const userProfile = this.convertToUserProfile(user)
    const token = await this.jwtService.generateToken(userProfile)
    return new LoginRes({ ...user, token })
  }

  async loginSocial(userData: UserLoginSocialRequest) {
    // const password = await hash('social', await genSalt())
    const user = await this.userRepository.create({ ...userData })
    const userProfile = this.convertToUserProfile(user)
    const token = await this.jwtService.generateToken(userProfile)
    return new LoginRes({ ...user, token })
  }
}
