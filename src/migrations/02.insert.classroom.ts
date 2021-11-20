/* eslint-disable linebreak-style */
import { JSONObject } from '@loopback/core'
import { GradeflixApplication } from '../application'
import { ClassroomRepository,  UserRepository } from '../repositories'
import { insertCsvToModel } from '../common/helpers/csv'
import { nanoid } from 'nanoid'
export default async function (app: GradeflixApplication) {
  const classrooms = await app.getRepository(ClassroomRepository)
  const users = await app.getRepository(UserRepository)
  
  await insertCsvToModel('./src/data/classrooms.csv', async (row: JSONObject) => {
    const user = await users.findOne({ where: { email: row.emailHost?.toString() } })

    const classroom = await classrooms.findOne({
      where: { name: row.name?.toString(), hostId: user?.id },
    })
    if (!classroom) {
      await classrooms.create({
        id: nanoid(8),
        name: row.name?.toString(),
        hostId: user?.id,
        description: row.description?.toString(),
        subject: row.subject?.toString(),
        banner: row.banner?.toString(),
      })
    }
  })
}
