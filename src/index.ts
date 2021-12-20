import { GradeflixApplication } from './application'

import { config } from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { ApplicationConfig } from '@loopback/core'


const init = () => {
  const env = config()
  dotenvExpand(env)
  // setupBindings(app)
  console.log('Environment variables:', env.parsed)
  console.log('Initializing environments...Done!')
}

init()

export async function main(options: ApplicationConfig = {}) {
  const app = new GradeflixApplication(options)
  
  await app.boot()
  await app.start()
  // const io = require('socket.io')();

  const url = app.restServer.url
  console.log(`Server is running at ${url}`)
  console.log(`Try ${url}/ping`)

  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // io.on('connection', (socket: any) => {
  //   console.log('ngon')
  //   socket.emit('a', {test: 'test'})


  //   socket.on("message", async (message: string) => {
  //     console.log(`${message}`)
  //   });
  // })
  // io.listen(3004)

  return app
}

if (require.main === module) {
  // Run the application
  const configApplication = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
  }
  main(configApplication).catch(err => {
    console.error('Cannot start the application.', err)
    process.exit(1)
  })
}
