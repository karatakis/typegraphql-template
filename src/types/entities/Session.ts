import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Field, ID, ObjectType } from 'type-graphql'
import { v4 } from 'uuid'
import { User } from './User'

@Entity()
@ObjectType()
export class Session {
  @PrimaryKey({ length: 36 })
  @Field(() => ID)
  id: string = v4()

  @ManyToOne(() => User)
  user: User

  @Property({ length: 36, nullable: true })
  refreshToken?: string

  @Property({ columnType: 'datetime' })
  @Field(() => Date)
  createdAt = new Date()

  @Property({ columnType: 'datetime', onUpdate: () => new Date() })
  @Field(() => Date)
  updatedAt = new Date()
}
