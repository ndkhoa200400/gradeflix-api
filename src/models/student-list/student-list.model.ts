/* eslint-disable @typescript-eslint/naming-convention */
import { belongsTo, hasMany, model, property } from '@loopback/repository'
import { Grades } from '.'
import { Classroom } from '..'
import { BaseEntity } from '../../common/models/base-entity.model'
import { TimeStampMixin } from '../../mixins'

@model({
  settings: {
    indexes: {
      student_list_student_id: {
        studentId: 1,
      },
      classroom_id: {
        classroomId: 1,
      },
    },
  },
})
export class StudentList extends TimeStampMixin(BaseEntity) {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id: number

  @belongsTo(() => Classroom)
  classroomId: string

  @property({
    type: 'string',
  })
  studentId: string

  @property({
    type: 'string',
  })
  fullName: string

  @hasMany(() => Grades)
  grades: Grades[]

  constructor(data?: Partial<StudentList>) {
    super(data)
  }
}

export interface StudentListRelations {
  // describe navigational properties here
}

export type StudentListWithRelations = StudentList & StudentListRelations
