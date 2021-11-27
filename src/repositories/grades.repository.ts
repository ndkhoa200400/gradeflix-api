/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, repository } from '@loopback/repository'
import { StudentListRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Grades, GradesRelations, StudentList } from '../models'

export class GradesRepository extends TimeStampRepositoryMixin<
  Grades,
  typeof Grades.prototype.id,
  Constructor<DefaultCrudRepository<Grades, typeof Grades.prototype.id, GradesRelations>>
>(DefaultCrudRepository) {
  public readonly student: BelongsToAccessor<StudentList, typeof StudentList.prototype.id>
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('StudentListRepository')
    studentListRepository: Getter<StudentListRepository>,
  ) {
    super(Grades, dataSource)

    this.student = this.createBelongsToAccessorFor('student', studentListRepository)
    this.registerInclusionResolver('student', this.student.inclusionResolver)
  }
}
