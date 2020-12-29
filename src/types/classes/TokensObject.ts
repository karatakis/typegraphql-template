import { Field, ObjectType } from 'type-graphql'

@ObjectType()
export class TokensObject {
  @Field()
  accessToken: string

  @Field({ nullable: true })
  refreshToken?: string
}
