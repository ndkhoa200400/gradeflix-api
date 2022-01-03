/* eslint-disable linebreak-style */
import { JSONObject } from '@loopback/core'
import { GradeflixApplication } from '../application'
import { UserRepository } from '../repositories'
import { insertCsvToModel } from '../common/helpers/csv'
import { genSalt, hash } from 'bcryptjs'
export default async function (app: GradeflixApplication) {
  const users = await app.getRepository(UserRepository)
  await insertCsvToModel('./src/data/users.csv', async (row: JSONObject) => {
    const user = await users.findOne({
      where: { email: row.email?.toString() },
    })
    if (!user) {
      const password = await hash(row.password?.toString() as string, await genSalt())

      await users.create({ ...row, password: password, activated: true })
    }
  })
}
