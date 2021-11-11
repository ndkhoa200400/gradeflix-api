/* eslint-disable linebreak-style */
import { MigrationRepository } from '../repositories'
import { GradeflixApplication } from '../application'

export async function migrations(app: GradeflixApplication) {
  const repos = await app.getRepository(MigrationRepository)
  const list: { name: string; migration: Function }[] = [
  
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
