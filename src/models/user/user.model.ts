import { hasMany, model, property } from '@loopback/repository'
import { Classroom, UserClassroom } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { UserRole } from '../../constants/role'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: { hidden: ['password'], strict: true },
})
export class User extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @property({
    type: 'string',
    default: '',
  })
  fullname: string

  @property({
    type: 'string',
    postgres: {
      nullable: 'true',
    },
  })
  googleId?: string

  @property({
    type: 'string',
    default: '01/01/1995'
  })
  birthday: string

  @property({
    type: 'string',
  })
  avatar?: string

  @property({
    type: 'string',
    index: { unique: true },
    required: true,
  })
  email: string

  @property({
    type: 'string',
    hidden: true,
  })
  password: string

  @property({
    type: 'string',
    default: '',
    postgres: {
      nullable: 'YES',
    },
  })
  studentId: string

  @property({
    type: 'boolean',
    default: true
  })
  active: boolean


  @property({
    type: 'boolean',
    default: false
  })
  activated: boolean

  @property({
    type: 'string',
    default: UserRole.USER,
    jsonSchema: {
      enum: Object.values(UserRole),
    },
  })
  role: UserRole

  @hasMany(() => Classroom, {
    through: {
      model: () => UserClassroom,
    },
  })
  classrooms: Classroom[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any

  constructor(data?: Partial<User>) {
    super(data)
    if (!this.fullname) this.fullname = this.email
  }
}

@model()
export class LoginReq {
  @property({
    type: 'string',
  })
  email: string

  @property({
    type: 'string',
  })
  password: string
}

@model()
export class LoginRes extends User {
  @property({
    type: 'string',
  })
  token?: string
}
export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations
