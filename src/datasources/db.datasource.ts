import { inject, lifeCycleObserver, LifeCycleObserver } from '@loopback/core'
import { juggler } from '@loopback/repository'
import { config } from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const loadEnvironment = () => {
  const env = config()
  dotenvExpand(env)
}

loadEnvironment()

let configDb = {}; 
if (process.env.NODE_ENV === 'dev')
{
  configDb = {
    name: 'db',
    connector: 'postgresql',
    url: '',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: process.env.POSTGRES_PORT ?? 5432,
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'gradeflix',
    max: 150,
  }
}
else {
  configDb = {
    name: 'db',
    connector: 'postgresql',
    url: process.env.DATABASE_URL,
    max: 150,
  }
}

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class DbDataSource extends juggler.DataSource implements LifeCycleObserver {
  static dataSourceName = 'db'
  static readonly defaultConfig = configDb

  constructor(
    @inject('datasources.config.db', { optional: true })
    dsConfig: object = configDb,
  ) {
    super(dsConfig)
  }
}
