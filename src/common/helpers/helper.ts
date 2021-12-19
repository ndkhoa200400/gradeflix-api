import { GradeStructure } from '../../models'
import { UserRepository } from '../../repositories'

async function checkUniqueStudentId(studentId: string, userRepository: UserRepository) {
  const countStudentExisted = await userRepository.count({
    studentId: studentId,
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

export { checkUniqueStudentId, validateGrade }
