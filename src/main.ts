import 'reflect-metadata'
import { ApolloServer } from 'apollo-server'
import { buildSchema } from 'type-graphql'
import { MikroORM } from '@mikro-orm/core'

import dbConfig from 'src/mikro-orm.config'
import {
  CoreResolver,
  UserResolver
} from 'src/resolvers'
import { CustomContext } from 'src/types/interfaces/CustomContext'
import { setupMailService } from 'src/dependencies/MailService'
import { setupQueueWorkers } from 'src/dependencies/Queues'
import { AuthMiddleware } from 'src/middlewares/AuthMiddleware'
import { ENVIRONMENT, PORT } from './dependencies/Config'
import { ErrorInterceptor } from './middlewares/ErrorInterceptor'

async function main (): Promise<void> {
  console.log(`ENVIRONMENT: ${ENVIRONMENT}`)
  console.log('=== SETUP DATABASE ===')
  const connection = await MikroORM.init(dbConfig)
  console.log('=== SETUP MAIL SERVICE ===')
  await setupMailService()
  console.log('=== SETUP WORKERS ===')
  setupQueueWorkers(connection).catch(err => {
    console.error('QUEUE ERROR', err)
    process.exit(1)
  })

  console.log('=== BUILDING GQL SCHEMA ===')
  const schema = await buildSchema({
    resolvers: [
      CoreResolver,
      UserResolver
    ],
    globalMiddlewares: [
      ErrorInterceptor,
      AuthMiddleware
    ]
  })

  const server = new ApolloServer({
    schema,
    playground: true,
    context ({ req, res }): CustomContext {
      return {
        req,
        res,
        em: connection.em.fork(),
        user: null
      }
    }
  })

  const { url } = await server.listen(PORT)

  console.log(`Server is running, GraphQL Playground available at ${url}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
