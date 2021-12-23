/* eslint-disable @typescript-eslint/naming-convention */
import { belongsTo, model, property } from '@loopback/repository'
import { User } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    indexes: {
      user_idx: {
        userId: 1,
      },
    },
  },
})
export class Notification extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => User)
  userId: number

  @property({
    type: 'string',
  })
  content: string

  @property({
    type: 'string',
  })
  link: string

  @property({
    type: 'boolean',
    default: false
  })
  isRead: boolean

  constructor(data?: Partial<Notification>) {
    super(data)
  }
}

export interface NotificationRelations {
  // describe navigational properties here
  user: User
}

export type NotificationWithRelations = Notification & NotificationRelations
