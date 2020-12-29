import { EntityManager } from '@mikro-orm/core'
import { User } from 'src/types/entities'
import { Request, Response } from 'express'

export interface CustomContext {
  req: Request

  res: Response

  em: EntityManager

  user: User | null
}
