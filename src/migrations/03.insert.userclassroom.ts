/* eslint-disable linebreak-style */
import { JSONObject } from '@loopback/core'
import { GradeflixApplication } from '../application'
import { ClassroomRepository, UserClassroomRepository, UserRepository } from '../repositories'
import { insertCsvToModel } from '../common/helpers/csv'
import { ClassroomRole } from '../constants/role'
export default async function (app: GradeflixApplication) {
  const classrooms = await app.getRepository(ClassroomRepository)
  const users = await app.getRepository(UserRepository)
  const userClassrooms = await app.getRepository(UserClassroomRepository)
  await insertCsvToModel('./src/data/userclassroom.csv', async (row: JSONObject) => {
    const user = await users.findOne({
      where: { email: row.email?.toString() },
    })

    const host = await users.findOne({
      where: { email: row.emailHost?.toString() },
    })
    const classroom = await classrooms.findOne({
      where: {
        hostId: host?.id,
      },
    })
    const userClassroom = await userClassrooms.findOne({
      where: {
        userId: user?.id,
        classroomId: classroom?.id,
      },
    })
    if (!userClassroom) {
      await userClassrooms.create({
        classroomId: classroom?.id,
        userId: user?.id,
        userRole: row.userRole?.toString() as ClassroomRole,
      })
    }
  })
}
