/* eslint-disable linebreak-style */
import { MixinTarget } from '@loopback/core'
import { property } from '@loopback/repository'

export function TimeStampMixin<T extends MixinTarget<object>>(baseClass: T) {
  class MixedModel extends baseClass {
    @property({
      type: 'date',
      defaultFn: 'now',
      name:'createat'
    })
    createdAt?: Date

    @property({
      type: 'date',
      defaultFn: 'now',
      name:'updatedat'
    })
    updatedAt?: Date
  }

  return MixedModel
}
