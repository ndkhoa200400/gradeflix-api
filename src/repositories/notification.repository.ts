/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, repository } from '@loopback/repository'
import { UserRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { User, Notification, NotificationRelations } from '../models'

export class NotificationRepository extends TimeStampRepositoryMixin<
  Notification,
  typeof Notification.prototype.id,
  Constructor<
    DefaultCrudRepository<
      Notification,
      typeof Notification.prototype.id | string,
      NotificationRelations
    >
  >
>(DefaultCrudRepository) {
  public readonly user: BelongsToAccessor<User, typeof User.prototype.id>
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('UserRepository')
    userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Notification, dataSource)

    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter)
    this.registerInclusionResolver('user', this.user.inclusionResolver)
  }
}
