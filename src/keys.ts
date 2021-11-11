import { TokenService, UserService } from '@loopback/authentication'

import { BindingKey } from '@loopback/core'
import { LoginReq, User } from './models'
import { EmailManager } from './services'
import { PasswordHasher } from './services/hash-password.service'

export namespace PasswordHasherBindings {
  export const PASSWORD_HASHER = BindingKey.create<PasswordHasher>('services.hasher')
  export const ROUNDS = BindingKey.create<number>('services.hasher.rounds')
}

export namespace UserServiceBindings {
  export const USER_SERVICE =
    BindingKey.create<UserService<User, LoginReq>>('services.user.service')
}

export namespace TokenServiceBindings {
  export const TOKEN_SERVICE = BindingKey.create<TokenService>(
    'services.authentication.jwt.tokenservice',
  );
}

export namespace EmailManagerBindings {
  export const SEND_MAIL = BindingKey.create<EmailManager>('services.email.send');
}