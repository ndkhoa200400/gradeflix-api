import { model, property } from '@loopback/repository'

import { User } from '..'
import { ClassroomRole } from '../../constants/role'
import { Classroom } from '.'
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
  }
}

@model()
export class ClassroomWithUsersResponse extends Classroom {
  @property.array(UserWithRole)
  users: UserWithRole[]

  constructor(data?: Partial<ClassroomWithUsersResponse>) {
    super(data)
  }
}

@model()
export class ClassroomWithUserResponse extends Classroom {
  @property(UserWithRole)
  user: UserWithRole

  constructor(data?: Partial<ClassroomWithUserResponse>) {
    super(data)
  }
}
