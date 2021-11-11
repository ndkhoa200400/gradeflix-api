import { model, property } from '@loopback/repository'

@model()
export class ResponseDto<DataResponseType> {
  @property({ type: 'string' })
  code: string

  @property({ type: 'object' })
  data: null | DataResponseType

  @property({ type: 'string' })
  message: string
}
