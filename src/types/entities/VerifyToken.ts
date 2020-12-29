import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { User } from './User'

@Entity()
export class VerifyToken {
  @PrimaryKey({ length: 36 })
  id: string = v4()

  @OneToOne(() => User)
  user: User

  @Property({ columnType: 'datetime' })
  createdAt = new Date()
}
