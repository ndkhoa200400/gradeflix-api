import {MixinTarget} from '@loopback/core'
import {property} from '@loopback/repository'
import {Model} from '@loopback/rest'

export function UserAndTimeStampMixin<T extends MixinTarget<Model>>(
  superClass: T
) {
  class MixedModel extends superClass {
    @property({
      type: 'number',
      required: false,
      index: true,
    })
    userId?: number

    @property({
      type: 'date',
      defaultFn: 'now',
    })
    createdAt?: Date

    @property({
      type: 'date',
      defaultFn: 'now',
    })
    updatedAt?: Date
  }

  return MixedModel
}
