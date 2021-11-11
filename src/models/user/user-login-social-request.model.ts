import { Entity, model, property } from '@loopback/repository'


@model()
export class UserLoginSocialRequest extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @property({
    type: 'string',
  })
  fullname: string

  @property({
    type: 'string',
  })
  avatar?: string

  @property({
    type: 'string',
    index: { unique: true },
    required: true,
  })
  email: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any

  constructor(data?: Partial<UserLoginSocialRequest>) {
    super(data)
  }
}
