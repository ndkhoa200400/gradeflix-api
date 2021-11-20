/* eslint-disable linebreak-style */
import { MigrationRepository } from '../repositories'
import { GradeflixApplication } from '../application'
import insertUser from './01.insert.users'
import insertClassroom from './02.insert.classroom'
import insertUserClassroom from './03.insert.userclassroom'
export async function migrations(app: GradeflixApplication) {
  const repos = await app.getRepository(MigrationRepository)
  const list: { name: string; migration: Function }[] = [
    { name: '01.insert.users', migration: insertUser },
    { name: '02.insert.classroom', migration: insertClassroom },
    { name: '03.insert.userclassroom', migration: insertUserClassroom },
  ]
  for (const migration of list) {
    const findMigration = await repos.findOne({
      where: { name: migration.name },
    })
    if (!findMigration) {
      console.log(`start migration ${migration.name}`)
      await migration.migration(app)
      await repos.create({ name: migration.name })
      console.log(`done migration ${migration.name}`)
    }
  }

  console.log('inserting')
}
