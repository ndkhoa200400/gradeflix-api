import { belongsTo, model, property } from '@loopback/repository'
import { Classroom, User } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { ClassroomRole } from '../../constants/classroom-role'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    strict: true,
    indexes: {
      compositeKeyUserClassroom: {
        keys: {
          userId: 1,
          classroomId: 1,
        },
        options: {
          unique: true,
        },
      },
      compositeKeyStudentIdClassroomId: {
        keys: {
          classroomId: 1,
          studentId: 1,
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

  @property({
    type: 'string',
    postgres: {
      nullable: 'YES',
    },
  })
  studentId?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any

  constructor(data?: Partial<UserClassroom>) {
    super(data)
  }
}

export interface UserClassroomRelations {
  // describe navigational properties here
}

export type UserClassroomWithRelations = UserClassroom & UserClassroomRelations
