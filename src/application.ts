import { ApplicationConfig } from '@loopback/core'
import { RestApplication } from '@loopback/rest'
import { MySequence } from './sequence'
import path from 'path'
import { BootMixin } from '@loopback/boot'
import { RepositoryMixin } from '@loopback/repository'
import { ServiceMixin } from '@loopback/service-proxy'
import { AuthenticationComponent, registerAuthenticationStrategy } from '@loopback/authentication'
import { RestExplorerBindings, RestExplorerComponent } from '@loopback/rest-explorer'
import { JWTAuthenticationComponent } from '@loopback/authentication-jwt'
import { EmailManagerBindings, PasswordHasherBindings, TokenServiceBindings, UserServiceBindings } from './keys'
import { BcryptHasher } from './services/hash-password.service'
import { EmailService, JWTService, MyUserService } from './services'
import { JWTStrategy } from './authenticate-strategy/jwt.strategy'

export class GradeflixApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options)

    // Set up the custom sequence
    this.sequence(MySequence)

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'))
    this.component(AuthenticationComponent)
    // Mount jwt component
    this.component(JWTAuthenticationComponent)

    registerAuthenticationStrategy(this, JWTStrategy)

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    })
    this.component(RestExplorerComponent)
    this.setupBinding()
    this.projectRoot = __dirname
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    }
  }

  setupBinding() {
    this.bind(PasswordHasherBindings.PASSWORD_HASHER).toClass(BcryptHasher)
    this.bind(PasswordHasherBindings.ROUNDS).to(10)
    this.bind(UserServiceBindings.USER_SERVICE).toClass(MyUserService)
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);
    this.bind(EmailManagerBindings.SEND_MAIL).toClass(EmailService)
  }
}
