import { UserRepository } from '../../repositories'

async function checkUniqueStudentId(studentId: string, userRepository: UserRepository) {
  const countStudentExisted = await userRepository.count({
    studentId: studentId,
  })

  return countStudentExisted.count === 0
}

export { checkUniqueStudentId }
