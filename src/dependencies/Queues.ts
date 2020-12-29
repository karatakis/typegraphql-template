import { MikroORM } from '@mikro-orm/core'
import Queue, { ProcessCallbackFunction, QueueOptions } from 'bull'
import { subDays, subHours } from 'date-fns'
import { Session } from 'inspector'
import { sendEmail } from 'src/dependencies/MailService'
import { ResetToken, VerifyToken } from 'src/types/entities'
import { ExpireJob } from 'src/types/interfaces/ExpireJob'
import { MailJob } from 'src/types/interfaces/MailJob'
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_DB,
  REDIS_USERNAME,
  REDIS_PASSWORD
} from 'src/dependencies/Config'

const options: QueueOptions = {
  redis: {
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB
  }
}

export const mailQueue = new Queue<MailJob>('mail', options)
export const expireQueue = new Queue<ExpireJob>('expire', options)

const mailQueueHandler: ProcessCallbackFunction<MailJob> = async (job, done): Promise<void> => {
  await sendEmail(
    job.data.address,
    job.data.subject,
    job.data.body,
    job.data.body
  )

  done()
}

function setupExpireQueueHandler (connection: MikroORM): ProcessCallbackFunction<ExpireJob> {
  return async (job, done): Promise<void> => {
    const em = connection.em.fork()

    switch (job.data.type) {
      case 'RESET':
        // used to expire reset tokens after 1 hour from their creation
        await em.nativeDelete(ResetToken, {
          createdAt: {
            $lt: subHours(new Date(), 1)
          }
        })
        break
      case 'SESSION':
        // used to expire sessions 7 days after last use
        await em.nativeDelete(Session, {
          updatedAt: {
            $lt: subDays(new Date(), 7)
          }
        })
        break
      case 'VERIFY':
        // used to expire verify tokens in 30 days
        await em.nativeDelete(VerifyToken, {
          createdAt: {
            $lt: subDays(new Date(), 30)
          }
        })
        break
      default:
        break
    }

    done()
  }
}

export async function setupQueueWorkers (connection: MikroORM): Promise<void> {
  await Promise.all([
    mailQueue.process(mailQueueHandler),
    expireQueue.process(setupExpireQueueHandler(connection))
  ])
}
