import { MikroORMOptions } from '@mikro-orm/core'
import { DATABASE_DATABASE, DATABASE_HOST, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_USER } from 'src/dependencies/Config'

const config: Partial<MikroORMOptions> = {
  type: 'mysql',
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  dbName: DATABASE_DATABASE,
  forceUtcTimezone: true,
  entitiesTs: ['./src/types/entities'],
  entities: ['./src/types/entities']
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default config
