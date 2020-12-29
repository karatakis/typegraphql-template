import { createTestAccount, createTransport, getTestMessageUrl, SentMessageInfo, TestAccount, Transporter } from 'nodemailer'
import { FetalErrorEnum } from 'src/types/enums/Errors'
import { APP_NAME, EMAIL_HOST } from 'src/dependencies/Config'

let account: TestAccount
let transporter: Transporter

export async function setupMailService (): Promise<void> {
  account = await createTestAccount()
  transporter = createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: account.user, // generated ethereal user
      pass: account.pass // generated ethereal password
    }
  })
}

export async function sendEmail (
  to: string,
  subject: string,
  text: string,
  html: string,
  serviceAddress = 'no-reply'
): Promise<SentMessageInfo> {
  if (transporter === undefined) {
    throw new Error(FetalErrorEnum.TRANSPORTER_NOT_INITIALIZED)
  }

  const info: SentMessageInfo = await transporter.sendMail({
    from: `"${APP_NAME}" <${serviceAddress}@${EMAIL_HOST}`,
    to,
    subject,
    replyTo: `no-reply@${EMAIL_HOST}`,
    text,
    html
  })
  // TODO remove
  console.log('Message sent: %s', info.messageId)
  console.log('Preview URL: %s', getTestMessageUrl(info))

  return info
}
