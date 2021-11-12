import { model, property } from '@loopback/repository'

@model()
export class SendInvitationRequest {
  @property({
    type: 'array',
    itemType:'string'
  })
  userEmails: string[]
}
