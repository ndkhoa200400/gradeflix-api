/* eslint-disable linebreak-style */
import { Constructor, inject } from '@loopback/core'
import { DefaultCrudRepository } from '@loopback/repository'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { Migration, MigrationRelations } from '../models'

export class MigrationRepository extends TimeStampRepositoryMixin<
  Migration,
  typeof Migration.prototype.id,
  Constructor<
    DefaultCrudRepository<
      Migration,
      typeof Migration.prototype.id,
      MigrationRelations
    >
  >
>(DefaultCrudRepository) {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(Migration, dataSource)
  }
}
