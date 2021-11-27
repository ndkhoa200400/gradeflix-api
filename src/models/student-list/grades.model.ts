import { model, belongsTo, property } from '@loopback/repository'

import { StudentList } from '.'
import { BaseEntity } from '../../common/models/base-entity.model'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    indexes: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      grade_student_list: {
        studentListId: 1,
      },
    },
  },
})
export class Grades extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => StudentList, { name: 'student' })
  studentListId: number

  @property({
    type: 'string',
  })
  name: string

  @property({
    type: 'string',
    default: '0',
  })
  grade: string

  constructor(data?: Partial<Grades>) {
    super(data)
  }
}

export interface GradesRelations {
  // describe navigational properties here
}

export type GradesWithRelations = Grades & GradesRelations
