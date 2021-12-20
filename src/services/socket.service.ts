/* eslint-disable @typescript-eslint/no-explicit-any */

import { BindingScope, injectable } from "@loopback/core"

@injectable({ scope: BindingScope.SINGLETON })
export class SocketIoService {
  public io = require('socket.io')()
  constructor() {
    
    this.io.on('connection', (socket: any) => {
      console.log('ngon')
      socket.emit('a', { test: 'test' })

      socket.on('message', async (message: string) => {
        console.log(`${message}`)
      })
    })
    this.io.listen(3004)
    console.log('listening on 3004')
  }
}
