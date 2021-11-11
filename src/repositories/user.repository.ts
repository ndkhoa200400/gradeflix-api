/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import {
  DefaultCrudRepository,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository'
import { ClassroomRepository, UserClassroomRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Classroom, User, UserClassroom, UserRelations } from '../models'

export class UserRepository extends TimeStampRepositoryMixin<
  User,
  typeof User.prototype.id,
  Constructor<DefaultCrudRepository<User, typeof User.prototype.id, UserRelations>>
>(DefaultCrudRepository) {
  public readonly classrooms: HasManyThroughRepositoryFactory<
    Classroom,
    typeof Classroom.prototype.pid,
    UserClassroom,
    typeof User.prototype.id
  >
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('ClassroomRepository')
    classroomRepositoryGetter: Getter<ClassroomRepository>,
    @repository.getter('UserClassroomRepository')
    userClassroomRepositoryGetter: Getter<UserClassroomRepository>,
  ) {
    super(User, dataSource)

    this.classrooms = this.createHasManyThroughRepositoryFactoryFor(
      'classrooms',
      classroomRepositoryGetter,
      userClassroomRepositoryGetter,
    )
  }
}
