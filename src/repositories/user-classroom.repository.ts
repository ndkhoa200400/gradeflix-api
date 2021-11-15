/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, repository } from '@loopback/repository'
import { ClassroomRepository, UserRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Classroom, User, UserClassroom, UserClassroomRelations } from '../models'

export class UserClassroomRepository extends TimeStampRepositoryMixin<
  UserClassroom,
  typeof UserClassroom.prototype.id,
  Constructor<
    DefaultCrudRepository<UserClassroom, typeof UserClassroom.prototype.id | string, UserClassroomRelations>
  >
>(DefaultCrudRepository) {
  public readonly user: BelongsToAccessor<User, typeof User.prototype.id>
  public readonly classroom: BelongsToAccessor<Classroom, typeof Classroom.prototype.id>
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('UserRepository')
    userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('ClassroomRepository')
    classroomRepositoryGetter: Getter<ClassroomRepository>,
  ) {
    super(UserClassroom, dataSource)

    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter)
    this.registerInclusionResolver('user', this.user.inclusionResolver)

    this.classroom = this.createBelongsToAccessorFor('classroom', classroomRepositoryGetter)
    this.registerInclusionResolver('classroom', this.classroom.inclusionResolver)
  }
}
