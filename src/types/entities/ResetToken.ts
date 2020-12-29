import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { User } from './User'

@Entity()
export class ResetToken {
  @PrimaryKey({ length: 36 })
  id: string = v4()

  @ManyToOne(() => User)
  user: User

  @Property(({ columnType: 'datetime' }))
  createdAt = new Date()
}
