import { Grades, GradeStructure } from '../../models'

function calculateTotal(grades: Grades[], gradeStructure: GradeStructure) {
  if (!grades || grades.length === 0) return '0'
  let total = 0

  for (const grade of grades) {
    const parem = gradeStructure.parems.find(p => p.name === grade.name)
    const g = Number(grade.grade)

    if (!g || !parem) continue
    total += (g * Number(parem.percent)) / 100
  }

  return total.toFixed(2)
}

export default calculateTotal
