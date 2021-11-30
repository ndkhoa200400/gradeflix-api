import { model, property } from '@loopback/repository'
import { StudentList } from '.'

@model()
export class UploadGradesResponse {
  @property.array(StudentList)
  studentList: StudentList[]

  @property({
    type: 'array',
    itemType: 'string',
  })
  errorList: string[]
}
