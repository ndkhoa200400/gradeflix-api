/* eslint-disable @typescript-eslint/naming-convention */
import { belongsTo, model, property } from '@loopback/repository'
import { GradeReview } from '.'
import { User } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    indexes: {
      user_gradereview_idx: {
        gradeReviewId: 1,
        userId: 1,
      },
    },
  },
})
export class CommentOnReview extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => User)
  userId: number

  @belongsTo(() => GradeReview)
  gradeReviewId: number

  @property({
    type: 'string',
  })
  comment: string

  constructor(data?: Partial<CommentOnReview>) {
    super(data)
  }
}

export interface CommentOnReviewRelations {
  // describe navigational properties here
  user?: User
}

export type CommentOnReviewWithRelations = CommentOnReview & CommentOnReviewRelations
