export const EmailConfig = {
  type: 'smtp',
  host: 'smtp.gmail.com',
  secure: true,
  port: 465,
  tls: {
    rejectUnauthorized: false,
  },
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
}
