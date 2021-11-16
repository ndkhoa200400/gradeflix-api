/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, repository } from '@loopback/repository'
import { UserRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Classroom, ClassroomRelations, User } from '../models'

export class ClassroomRepository extends TimeStampRepositoryMixin<
  Classroom,
  typeof Classroom.prototype.id | number,
  Constructor<DefaultCrudRepository<Classroom, typeof Classroom.prototype.id | number, ClassroomRelations>>
>(DefaultCrudRepository) {
  public readonly host: BelongsToAccessor<User, typeof User.prototype.id>

  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('UserRepository')
    userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Classroom, dataSource)

    this.host = this.createBelongsToAccessorFor('host', userRepositoryGetter)
    this.registerInclusionResolver('host', this.host.inclusionResolver);

  }
}
