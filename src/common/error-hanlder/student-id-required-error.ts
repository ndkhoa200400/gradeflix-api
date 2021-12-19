import { HttpErrors } from '@loopback/rest'

export class StudentIdRequiredError extends HttpErrors.BadRequest {
  constructor(message?: string) {
    if (!message) {
      message = 'Vui lòng thêm mã số sinh viên.'
    }
    super(message)
    this.name = 'StudentIdRequired'
  }
}
