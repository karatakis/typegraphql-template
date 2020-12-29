import { IsBoolean, IsEmail, IsString } from 'class-validator'
import { Field, InputType } from 'type-graphql'

@InputType()
export class LoginInput {
  @Field()
  @IsString()
  @IsEmail()
  email: string

  @Field()
  @IsString()
  password: string

  @Field()
  @IsBoolean()
  remember: boolean
}
