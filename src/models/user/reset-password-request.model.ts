import { Model, model, property } from '@loopback/repository'

@model()
export class ResetPasswordRequest extends Model {
  @property({
    type: 'string',
  })
  email: string

  @property({
    type: 'string'
  })
  newPassword?: string

}

