import { Collection, Entity, Enum, OneToMany, OneToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { UserRole } from 'src/types/enums/UserRole'
import { VerifyToken } from './VerifyToken'
import { ResetToken } from './ResetToken'
import { Session } from './Session'
import { Field, ID, ObjectType } from 'type-graphql'

@Entity()
@ObjectType()
export class User {
  @PrimaryKey({ length: 36 })
  @Field(() => ID)
  id: string = v4()

  @Property()
  @Field()
  name: string

  @Property()
  @Unique()
  @Field()
  email: string

  @Property({ columnType: 'datetime', nullable: true })
  @Field(() => Date, { nullable: true })
  emailVerifiedAt?: Date

  @Property()
  password: string

  @Enum({ items: () => UserRole, default: UserRole.USER })
  // @Field() TODO
  role: UserRole = UserRole.USER

  @OneToOne(() => VerifyToken, token => token.user, { nullable: true })
  verifyToken?: VerifyToken

  @OneToMany(() => ResetToken, token => token.user)
  resetTokens = new Collection<ResetToken>(this)

  @OneToMany(() => Session, session => session.user)
  sessions = new Collection<Session>(this)

  @Property({ columnType: 'datetime' })
  @Field(() => Date)
  createdAt = new Date()

  @Property({ onUpdate: () => new Date(), columnType: 'datetime' })
  @Field(() => Date)
  updatedAt = new Date()
}
