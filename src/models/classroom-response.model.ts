import { model, property } from '@loopback/repository'

import { Classroom, User } from '.'
import { ClassroomRole } from '../constants/classroom-role'

@model({ strict: true })
export class UserWithRole extends User {
  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(ClassroomRole),
    },
  })
  userRole?: ClassroomRole

  constructor(data?: Partial<Omit<UserWithRole, 'password'>>) {
    super(data)
    console.log('data', data)
  }
}

@model()
export class GetOneClassroomResponse extends Classroom {
  @property.array(UserWithRole)
  users: UserWithRole[]

  constructor(data?: Partial<GetOneClassroomResponse>) {
    super(data)
  }
}

@model()
export class GetManyClassroomResponse extends Classroom {
  @property(UserWithRole)
  user: UserWithRole

  constructor(data?: Partial<GetManyClassroomResponse>) {
    super(data)
  }
}
