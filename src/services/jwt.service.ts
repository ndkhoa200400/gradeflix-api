import { HttpErrors } from '@loopback/rest'
import { securityId, UserProfile } from '@loopback/security'
import { promisify } from 'util'

const jwt = require('jsonwebtoken')
const signAsync = promisify(jwt.sign)
const verifyAsync = promisify(jwt.verify)

const jwtSecret = process.env.JWT_SECRET
const expiresSecret = process.env.JWT_EXPIRE_IN
export class JWTService {
  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized('Error while generating token :userProfile is null')
    }
    let token = ''
    try {
      token = await signAsync(userProfile, jwtSecret, {
        expiresIn: expiresSecret,
      })
      return token
    } catch (err) {
      throw new HttpErrors.Unauthorized(`error generating token ${err}`)
    }
  }

  async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new HttpErrors.Unauthorized(`Không tìm thấy token. Vui lòng đăng nhập lại!`)
    }

    const decryptedToken = await verifyAsync(token, jwtSecret)

    const userProfile = Object.assign(
      { [securityId]: '', name: '' },
      {
        [securityId]: decryptedToken.id,
        email: decryptedToken.email,
        id: decryptedToken.id,
      },
    )
    return userProfile
  }
}
