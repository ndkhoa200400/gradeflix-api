import { Model, model, property } from '@loopback/repository'

@model()
export class FinalGradeRequest extends Model {
  @property({
    type: 'string',
    description: 'Grade name',
  })
  name: string

  @property({
    type: 'string',
  })
  grade: string

  @property({
    type: 'string',
  })
  studentId: string

  constructor(data?: Partial<FinalGradeRequest>) {
    super(data)
  }
}
