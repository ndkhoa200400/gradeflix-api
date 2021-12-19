/* eslint-disable @typescript-eslint/naming-convention */
import { belongsTo, model, property } from '@loopback/repository'
import { Classroom, User } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { ClassroomRole } from '../../constants/role'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    strict: true,
    indexes: {
      composite_key_userclassroom: {
        keys: {
          userId: 1,
          classroomId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class UserClassroom extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => User, { name: 'user' })
  userId: number

  @belongsTo(() => Classroom, { name: 'classroom' })
  classroomId: string

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(ClassroomRole),
    },
  })
  userRole: ClassroomRole
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any

  constructor(data?: Partial<UserClassroom>) {
    super(data)
  }
}

export interface UserClassroomRelations {
  // describe navigational properties here
  user: User
  classroom: Classroom
}

export type UserClassroomWithRelations = UserClassroom & UserClassroomRelations
