export class NotFound extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.statusCode = 404
  }
}

export class CreateError extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.statusCode = 400
  }
}
