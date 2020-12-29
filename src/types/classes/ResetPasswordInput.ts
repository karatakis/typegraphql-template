import { IsString, IsUUID, MinLength } from 'class-validator'
import { Field, InputType } from 'type-graphql'

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsUUID()
  token: string

  @Field()
  @IsString()
  @MinLength(8)
  password: string
}
