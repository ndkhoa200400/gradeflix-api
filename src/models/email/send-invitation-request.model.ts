import { model, property } from '@loopback/repository'

@model()
export class SendInvitationRequest {
  @property({
    type: 'string',
  })
  userEmails: string
}
