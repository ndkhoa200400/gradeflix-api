import { model, property } from '@loopback/repository'
import { StudentList } from '.'
import { User } from '..'

@model()
export class StudentListResponse extends StudentList {
  @property({
    type: User
  })
  user: User | null

  constructor(data?: Partial<StudentListResponse>) {
    super(data)
  }
}
