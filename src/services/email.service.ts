import * as nodemailer from 'nodemailer'
import { EmailConfig } from '../common/helpers/email-config'
import Mail = require('nodemailer/lib/mailer')
import * as ejs from 'ejs'
import * as fs from 'fs'
const juice = require('juice')
import { htmlToText } from 'html-to-text'
export interface EmailManager<T = Object> {
  sendMail(data: object): Promise<T>
}

export interface IEmailRequest {
  from?: string
  to?: string
  html?: string
  text?: string
  classroomName?: string
  invitee?: string
  role?: string
  subject?: string
  link?: string
}

export class EmailService {
  constructor() {}

  async sendMail(data: IEmailRequest): Promise<object> {
    const configOption = EmailConfig

    const transporter = nodemailer.createTransport(configOption)
    const mailObj = this.getEmailOption(data)
    return transporter.sendMail(mailObj)
  }

  getEmailOption(data: IEmailRequest) {
    const mailObj: Mail.Options = {}
    mailObj.from = data.from
    mailObj.to = data.to
    mailObj.subject = data.subject

    const templatePath = `./src/common/helpers/email.template.html`
    const template = fs.readFileSync(templatePath, 'utf-8')
    const html = ejs.render(template, data)

    const htmlWithStylesInlined = juice(html)
    const text = htmlToText(html)

    mailObj.html = htmlWithStylesInlined
    mailObj.text = text
    return mailObj
  }
}
