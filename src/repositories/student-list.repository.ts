/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  repository,
} from '@loopback/repository'
import { ClassroomRepository, GradesRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Classroom, Grades, StudentList, StudentListRelations } from '../models'

export class StudentListRepository extends TimeStampRepositoryMixin<
  StudentList,
  typeof StudentList.prototype.id,
  Constructor<
    DefaultCrudRepository<
      StudentList,
      typeof StudentList.prototype.id | string,
      StudentListRelations
    >
  >
>(DefaultCrudRepository) {
  public readonly grades: HasManyRepositoryFactory<Grades, typeof Grades.prototype.id>
  public readonly classroom: BelongsToAccessor<Classroom, typeof Classroom.prototype.id>
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('GradesRepository')
    gradesRepository: Getter<GradesRepository>,
    @repository.getter('ClassroomRepository')
    classroomRepository: Getter<ClassroomRepository>,
  ) {
    super(StudentList, dataSource)
    this.grades = this.createHasManyRepositoryFactoryFor('grades', gradesRepository)
    this.registerInclusionResolver('grades', this.grades.inclusionResolver)

    this.classroom = this.createBelongsToAccessorFor('classroom', classroomRepository)
    this.registerInclusionResolver('classroom', this.classroom.inclusionResolver)
  }
}
