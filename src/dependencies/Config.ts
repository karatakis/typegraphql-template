import dotenv from 'dotenv'

const env = process.env

dotenv.config({ path: `.env${env.NODE_ENV !== undefined ? '.' + env.NODE_ENV : ''}` })

export const APP_NAME: string = env.APP_NAME ?? 'TypeGraphQL Template'
export const ENVIRONMENT: string = env.NODE_ENV ?? 'development'
export const HOST: string = env.HOST ?? '127.0.0.1'
export const PORT: number = env.PORT !== undefined ? parseInt(env.PORT) : 4000

export const JWT_SECRET: string = env.JWT_SECRET ?? 'CHANGE_ME'

export const EMAIL_HOST: string = env.EMAIL_HOST ?? 'example.com'

export const DATABASE_HOST = env.DATABASE_HOST ?? '127.0.0.1'
export const DATABASE_PORT = env.DATABASE_PORT !== undefined ? parseInt(env.DATABASE_PORT) : 3306
export const DATABASE_USER = env.DATABASE_USER ?? 'root'
export const DATABASE_PASSWORD = env.DATABASE_PASSWORD ?? 'root'
export const DATABASE_DATABASE = env.DATABASE_DATABASE ?? 'demo-database'

export const REDIS_HOST = env.REDIS_HOST ?? '127.0.0.1'
export const REDIS_USERNAME = env.REDIS_USERNAME ?? undefined
export const REDIS_PASSWORD = env.REDIS_PASSWORD ?? undefined
export const REDIS_DB = env.REDIS_DB !== undefined ? parseInt(env.REDIS_DB) : 1
export const REDIS_PORT = env.REDIS_PORT !== undefined ? parseInt(env.REDIS_PORT) : 6379
