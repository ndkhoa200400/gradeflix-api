import { model, property } from '@loopback/repository'

@model({
  settings: { hidden: ['password'], strict: true },
})
export class PatchUserRequest {
  @property({
    type: 'string',
    required: true,
  })
  fullname: string

  @property({
    type: 'string',
  })
  avatar?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any
}

@model({})
export class UpdatePasswordRequest {
  @property({
    type: 'string',
    required: true,
  })
  oldPassword: string

  @property({
    type: 'string',
    required: true,
  })
  newPassword: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any
}
