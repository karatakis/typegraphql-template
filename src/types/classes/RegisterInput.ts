import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { Field, InputType } from 'type-graphql'

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string

  @Field()
  @IsEmail()
  email: string

  @Field()
  @IsString()
  @MinLength(8)
  password: string
}
