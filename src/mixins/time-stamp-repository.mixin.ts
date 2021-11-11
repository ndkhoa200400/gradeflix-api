/* eslint-disable linebreak-style */
import { Constructor } from '@loopback/core'
import {
  Count,
  DataObject,
  Entity,
  EntityCrudRepository,
  Options,
  Where,
} from '@loopback/repository'

// function resetSearchText(entityName: string, entityData: DataObject<Entity>)
// {
//   // Add search field based on config
//   const fields = _.get(searchFieldConfig, entityName)
//   if (fields) {
//     _.set(entityData, 'searchText', getSearchText(entityData, fields))
//   }
//   const codeField: string = _.get(entityData, 'code')
//   if (codeField) {
//     _.set(entityData, 'code', codeField.toUpperCase())
//   }
//   return entityData
// }

export function TimeStampRepositoryMixin<
  E extends Entity & { createdAt?: Date; updatedAt?: Date },
  ID,
  R extends Constructor<EntityCrudRepository<E, ID>>,
>(repository: R) {
  class MixedRepository extends repository {
    async create(entity: DataObject<E>, options?: Options): Promise<E> {
      entity.createdAt = new Date()
      entity.updatedAt = new Date()

      return super.create(entity, options)
    }

    async updateAll(data: DataObject<E>, where?: Where<E>, options?: Options): Promise<Count> {
      data.updatedAt = new Date()

      return super.updateAll(data, where, options)
    }

    async replaceById(id: ID, data: DataObject<E>, options?: Options): Promise<void> {
      data.updatedAt = new Date()

      return super.replaceById(id, data, options)
    }

    async updateById(id: ID, data: DataObject<E>, options?: Options): Promise<void> {
      data.updatedAt = new Date()

      return super.updateById(id, data, options)
    }

    async save(data: DataObject<E>, options?: Options): Promise<E> {
      data.updatedAt = new Date()

      return super.save(data, options)
    }
  }
  return MixedRepository
}
