import { Filter, EntityCrudRepository } from '@loopback/repository'
import { GradeStructure, User } from '../../models'
import { UserRepository } from '../../repositories'
import { PaginatedResponse, PaginatedRequestDto } from '../dtos'
import { BaseEntity } from '../models/base-entity.model'

async function checkUniqueStudentId(user: User, studentId: string, userRepository: UserRepository) {
  const countStudentExisted = await userRepository.count({
    studentId: studentId,
    id: { neq: user.id },
  })

  return countStudentExisted.count === 0
}

function validateGrade(grade: string, gradeStructure: GradeStructure) {
  const gradeNumber = Number(grade)
  const total = Number(gradeStructure.total)
  if (
    grade === '' ||
    Number.isNaN(gradeNumber) ||
    gradeNumber == null ||
    gradeNumber < 0 ||
    gradeNumber > total
  )
    return false
  return true
}

async function findAll<T extends BaseEntity>(
  filter: Filter<T>,
  repository: EntityCrudRepository<T, number | string, T>,
  pageSize?: number,
  pageIndex?: number,
) {
  const count = await repository.count(filter.where)
  const total = count.count
  pageSize = pageSize ?? total
  pageIndex = pageIndex ?? 1
  if (total <= 0) {
    return new PaginatedResponse<T>([], pageIndex, pageSize, total)
  }

  const paginated = new PaginatedRequestDto({
    pageSize,
    pageIndex,
  })

  filter.limit = pageSize
  filter.skip = paginated.skip
  const result = await repository.find(filter)
  return new PaginatedResponse<T>(result, pageIndex, pageSize, total)
}
export { checkUniqueStudentId, validateGrade, findAll }
