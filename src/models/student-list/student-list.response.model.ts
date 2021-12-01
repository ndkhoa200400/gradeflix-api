import { model, property } from '@loopback/repository'
import { StudentList } from '.'
import { UserClassroom } from '..'

@model()
export class StudentListResponse extends StudentList {
  @property({
    type: UserClassroom
  })
  user: UserClassroom | null

  constructor(data?: Partial<StudentListResponse>) {
    super(data)
  }
}
