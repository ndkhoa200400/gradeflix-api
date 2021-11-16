import { User } from '@loopback/authentication-jwt'
import { belongsTo, model, property } from '@loopback/repository'

import { BaseEntity } from '../common/models/base-entity.model'
import { TimeStampMixin } from '../mixins'

@model({
  settings: {
    indexes: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      classroom_host_idx: {
        hostId: 1,
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
  hostId: number;

  // Define well-known properties here



  constructor(data?: Partial<Classroom>) {
    super(data)
  }
}

export interface ClassroomRelations {
  // describe navigational properties here
}

export type ClassroomWithRelations = Classroom & ClassroomRelations
