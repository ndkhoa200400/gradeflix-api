/* eslint-disable @typescript-eslint/no-explicit-any */

import { BindingScope, ContextTags, injectable } from '@loopback/core'
import { SOCKETIO_SERVICE } from '../keys'

export interface OnlineUser {
  userId: number

  socketId: string
}

@injectable({ scope: BindingScope.SINGLETON, tags: { [ContextTags.KEY]: SOCKETIO_SERVICE } })
export class SocketIoService {
  public io = require('socket.io')()

  public users: OnlineUser[] = []
  constructor() {
    this.io.on('connection', (socket: any) => {
      socket.on('message', async (message: string) => {
        console.log(`${message}`)
      })

      socket.on('newUser', (userId: number) => {
        console.log(`New user with id ${userId} has joined`)
        this.addUser(userId, socket.id)
      })

      socket.on('disconnect', () => {
        this.removeUser(socket.id)
      })
    })
    this.io.listen(process.env.SOCKET_PORT)
    console.log(`Socket listening on PORT ${process.env.SOCKET_PORT}`)
  }

  public removeUser(socketId: string) {
    this.users = this.users.filter(user => user.socketId !== socketId)
  }

  public addUser(userId: number, socketId: string) {
    this.users.push({
      userId,
      socketId,
    })
  }

  public getUser(userId: number): OnlineUser | null {
    return this.users.find(user => user.userId === userId) ?? null
  }

  public sendMessage(userId: number, message: string) {
    const getUser = this.getUser(userId)
    this.io.to(getUser?.socketId).emit('message', message)
  }

  async sendNotification(userId: number, message: string): Promise<void> {
    const getUser = this.getUser(userId)
    this.io.to(getUser?.socketId).emit('notification', message)
  }
}
