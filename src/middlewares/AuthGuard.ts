import { MiddlewareFn } from 'type-graphql'
import { ForbiddenError } from 'apollo-server'

import { CustomContext } from 'src/types/interfaces/CustomContext'
import { ForbiddenErrorEnum } from 'src/types/enums/Errors';

export const AuthGuard: MiddlewareFn<CustomContext> = async ({ context }, next): Promise<void> => {
  if (context.user === null) {
    throw new ForbiddenError(ForbiddenErrorEnum.NOT_AUTHORIZED)
  }
  await next()
}