import { HttpErrors } from '@loopback/rest'

export class GradeReviewNotFoundError extends HttpErrors.NotFound {
  constructor(message?: string) {
    if (!message) {
      message = 'Không tìm thấy đơn phúc khảo.'
    }
    super(message)
    this.name = 'GradeReviewNotFound'
  }
}
