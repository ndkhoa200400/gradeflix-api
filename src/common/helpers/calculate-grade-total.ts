import { Grades, GradeStructure } from '../../models'

function calculateTotal(grades: Grades[], gradeStructure: GradeStructure) {
  if (!grades || grades.length === 0) return '0'
  let total = 0

  for (const grade of grades) {
    const gradeComposition = gradeStructure.gradeCompositions.find(p => p.name === grade.name)
    const studentGrade = Number(grade.grade)

    if (!studentGrade || !gradeComposition) continue
    total += (studentGrade * Number(gradeComposition.percent)) / 100
  }

  return total.toFixed(2)
}

export default calculateTotal
