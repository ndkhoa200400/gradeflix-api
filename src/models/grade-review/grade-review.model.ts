/* eslint-disable @typescript-eslint/naming-convention */
import { belongsTo, hasMany, Model, model, property } from '@loopback/repository'
import { CommentOnReview } from '.'
import { Classroom } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { GradeReviewStatus } from '../../constants/status'
import { TimeStampMixin } from '../../mixins'

@model()
export class Grade extends Model {
  @property({
    type: 'string',
  })
  name: string

  @property({
    type: 'string',
  })
  grade: string
  constructor(data?: Partial<Grade>) {
    super(data)
  }
}

@model({
  settings: {
    indexes: {
      classroom_student_idx: {
        classroomId: 1,
        studentId: 1,
      },
    },
  },
})
export class GradeReview extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => Classroom)
  classroomId: string

  @property({
    type: 'string',
  })
  studentId: string

  @property({
    type: Grade,
    postgresql: {
      dataType: 'jsonb',
    },
  })
  currentGrade: Grade

  @property({
    type: Grade,
    postgresql: {
      dataType: 'jsonb',
    },
  })
  expectedGrade: Grade

  @property({
    type: 'string',
    default: '',
  })
  explanation: string

  @property({
    type: 'string',
    default: GradeReviewStatus.PENDING,
    jsonSchema: {
      enum: Object.values(GradeReviewStatus),
    },
  })
  status: GradeReviewStatus

  @hasMany(() => CommentOnReview)
  comments: CommentOnReview[]
  

  constructor(data?: Partial<GradeReview>) {
    super(data)
  }
}

export interface GradeReviewRelations {
  // describe navigational properties here
  comments: CommentOnReview[]
}

export type GradeReviewWithRelations = GradeReview & GradeReviewRelations
