import { model, property } from '@loopback/repository'
import { TimeStampMixin } from '../mixins/time-stamp-model.mixin'
import { BaseEntity } from '../common/models/base-entity.model'

@model({
  settings: {
    strict: true,
    indexes: {
      uniqueName: {
        keys: {
          name: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class Migration extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'string',
    required: true,
  })
  name: string

  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id?: number

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any

  constructor(data?: Partial<Migration>) {
    super(data)
  }
}

export interface MigrationRelations {
  // describe navigational properties here
}

export type MigrationWithRelations = Migration & MigrationRelations
