
import { MiddlewareFn } from 'type-graphql'
import {
  ForbiddenError,
  UserInputError
} from 'apollo-server'
import {
  TokenExpiredError,
  JsonWebTokenError
} from 'jsonwebtoken'
import { CustomContext } from 'src/types/interfaces/CustomContext'
import { UserErrorEnum } from 'src/types/enums/Errors'

export const ErrorInterceptor: MiddlewareFn<CustomContext> = async (_, next): Promise<void> => {
  try {
    await next()
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof UserInputError ||
      error instanceof JsonWebTokenError ||
      error instanceof TokenExpiredError
    ) {
      throw error
    } else {
      throw new UserInputError(UserErrorEnum.INTERNAL_ERROR)
    }
  }
}
