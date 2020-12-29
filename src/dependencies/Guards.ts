import { isEmail, isString, isUUID } from 'class-validator'
import { UserInputError } from 'apollo-server'
import { UserErrorEnum } from 'src/types/enums/Errors'

export function isValidUUID (token: string): void {
  if (!isString(token) || !isUUID(token, '4')) {
    throw new UserInputError(UserErrorEnum.TOKEN_NOT_VALID_UUID)
  }
}

export function isValidEmail (email: string): void {
  if (!isString(email) || !isEmail(email)) {
    throw new UserInputError(UserErrorEnum.INVALID_EMAIL)
  }
}
