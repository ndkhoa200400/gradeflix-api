/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BindingScope, ContextTags, injectable } from '@loopback/core'
import * as http from 'http'
import { SOCKETIO_SERVICE } from '../keys'
import { Notification } from '../models'
import { Server } from 'socket.io'
export interface OnlineUser {
  userId: number

  socketId: string
}

@injectable({ scope: BindingScope.SINGLETON, tags: { [ContextTags.KEY]: SOCKETIO_SERVICE } })
export class SocketIoService {
  public io: any

  public users: OnlineUser[] = []
  constructor(httpServer: http.Server) {
    this.io = new Server(httpServer, {
      cors: { methods: '*', origin: '*', allowedHeaders: '*' },
    })
    this.io.on('connection', (socket: any) => {
      console.log('New connection ' + socket.id)
      socket.on('message', async (message: string) => {
        console.log(`${message}`)
      })

      socket.on('newUser', (userId: number) => {
        console.log(`New user with id ${userId} has joined`)
        this.addUser(userId, socket.id)
      })

      socket.on('disconnect', () => {
        console.log(`${socket.id} has left`)
        this.removeUser(socket.id)
      })

      socket.on('logOut', () => {
        this.removeUser(socket.id)
      })
    })
    console.log(`Socket listening on PORT ${process.env.PORT ?? 3000}`)
  }

  public removeUser(socketId: string) {
    this.users = this.users.filter(user => user.socketId !== socketId)
  }

  public addUser(userId: number, socketId: string) {
    if (!this.users.find(user => user.userId === userId)) {
      this.users.push({
        userId,
        socketId,
      })
    }
  }

  public getUser(userId: number): OnlineUser | null {
    return this.users.find(user => user.userId === userId) ?? null
  }

  async sendNotification(userId: number, notification: Notification): Promise<void> {
    const getUser = this.getUser(userId)
    this.io.to(getUser?.socketId).emit('notification', notification)
  }

  async sendMultipleNotifications(userIds: number[], notification: Notification): Promise<void> {
    for (const userId of userIds) {
      const getUser = this.getUser(userId)
      this.io.to(getUser?.socketId).emit('notification', notification)
    }
  }

  /**
   * When admin locks classroom => kick users and noti
   */
  async lockClassroom(userIds: number[], notifications: Notification[], classroomId: string) {
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i]
      const getUser = this.getUser(userId)
      this.io.to(getUser?.socketId).emit('classroomLocked', classroomId)
      await this.sendNotification(userId, notifications[i])
    }
  }

  async lockAccount(userId: number) {
    const getUser = this.getUser(userId)
    this.io.to(getUser?.socketId).emit('accountLocked')
  }
}
