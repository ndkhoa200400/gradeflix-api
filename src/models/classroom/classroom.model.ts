/* eslint-disable @typescript-eslint/naming-convention */
import { User } from '@loopback/authentication-jwt'
import { belongsTo, hasMany, model, property } from '@loopback/repository'
import { GradeStructure } from '.'
import { StudentList } from '..'

import { BaseEntity } from '../../common/models/base-entity.model'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    indexes: {
    
      classroom_host_idx: {
        hostId: 1,
      },
      classroom_code_idx: {
        code: 1,
      },
    },
  },
})
export class Classroom extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'string',
    id: true,
  })
  id: string

  @property({
    type: 'string',
  })
  name: string

  @property({
    type: 'string',
  })
  banner: string

  @property({
    type: 'string',
  })
  code: string

  @property({
    type: 'string',
  })
  description?: string

  @property({
    type: 'string',
  })
  subject?: string

  @property({
    type: 'string',
  })
  room?: string

  @belongsTo(() => User, { name: 'host' })
  hostId: number

  @property({
    type: 'object',
    postgresql: {
      dataType: 'jsonb',
    },
  })
  gradeStructure?: GradeStructure

  @property({
    type: 'boolean',
    default: true,
  })
  active: boolean

  @hasMany(() => StudentList)
  studentList: StudentList[]

  constructor(data?: Partial<Classroom>) {
    super(data)
  }
}

export interface ClassroomRelations {
  // describe navigational properties here
}

export type ClassroomWithRelations = Classroom & ClassroomRelations
