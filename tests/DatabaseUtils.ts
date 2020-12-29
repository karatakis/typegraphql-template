import { MikroORM } from '@mikro-orm/core'
import { DATABASE_DATABASE, DATABASE_HOST, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_USER } from 'src/dependencies/Config'

let connection: MikroORM | undefined

export async function getConnection (): Promise<MikroORM> {
  if (connection === undefined) {
    connection = await MikroORM.init({
      type: 'mysql',
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      user: DATABASE_USER,
      password: DATABASE_PASSWORD,
      dbName: DATABASE_DATABASE,
      forceUtcTimezone: true,
      entitiesTs: ['./src/types/entities'],
      entities: ['./src/types/entities']
    })

    await connection.getSchemaGenerator().dropSchema()
    await connection.getSchemaGenerator().createSchema()
  }
  return connection
}

export async function closeConnection (): Promise<void> {
  if (connection !== undefined) {
    await connection.close()
  }
  connection = undefined
}
