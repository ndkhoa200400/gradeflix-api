import { HttpErrors } from '@loopback/rest'

export class NoPermissionError extends HttpErrors.Forbidden {
  constructor(message?: string) {
    if (!message) {
      message = 'Bạn không có quyền thực hiện hành động này.'
    }
    super(message)
    this.name = 'NoPermissionToAccess'
  }
}
