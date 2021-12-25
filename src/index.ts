import { GradeflixApplication } from './application'

import { config } from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { ApplicationConfig, BindingScope } from '@loopback/core'
import { SocketIoService } from './services'
import { SOCKETIO_SERVICE } from './keys'
import { createServer } from 'http'
import { AddressInfo } from 'net'

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
  const httpServer = createServer(app.requestHandler)
  const io = new SocketIoService(httpServer)

  await app.boot()
  // await app.start()

  app
    .bind(SOCKETIO_SERVICE)
    .toDynamicValue(() => io)
    .inScope(BindingScope.SINGLETON)

  const port = +(process.env.PORT ?? 3000)
  const host = process.env.HOST
  httpServer.listen(
    {
      port: port,
      host: host,
    },
    () => {
      const url = `http://localhost:${port}`
      console.log(`Server is running at ${url}`)
      console.log(`Try ${url}/ping`)
    },
  )
  return httpServer
}

if (require.main === module) {
  // Run the application
  const configApplication: ApplicationConfig = {
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
    httpServerOptions: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
    },
  }
  main(configApplication).catch(err => {
    console.error('Cannot start the application.', err)
    process.exit(1)
  })
}
