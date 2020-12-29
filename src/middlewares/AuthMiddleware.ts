import { MiddlewareFn } from 'type-graphql'
import { verify } from 'jsonwebtoken'
import { ForbiddenError } from 'apollo-server'

import { CustomContext } from 'src/types/interfaces/CustomContext'
import { JWT_SECRET } from 'src/dependencies/Config'
import { AccessToken, RefreshToken } from 'src/types/interfaces/JwtToken'
import { Session, User } from 'src/types/entities'
import { ForbiddenErrorEnum } from 'src/types/enums/Errors'

export const AuthMiddleware: MiddlewareFn<CustomContext> = async ({ context }, next): Promise<void> => {
  const authorization = context.req.headers.authorization ?? ''
  if (authorization.includes('Bearer ')) {
    const token = authorization.replace('Bearer ', '')

    // TODO missing try catch
    const payload = verify(token, JWT_SECRET) as AccessToken | RefreshToken

    if (payload.type !== 'ACCESS') {
      throw new ForbiddenError(ForbiddenErrorEnum.INVALID_TOKEN)
    }

    const session = await context.em.findOne(Session, { id: payload.sessionId })
    if (session === null) {
      throw new ForbiddenError(ForbiddenErrorEnum.TOKEN_EXPIRED)
    }
    // used to expire sessions after 7 days of inactivity
    session.updatedAt = new Date()
    context.em.persist(session)

    context.user = await context.em.findOne(User, { id: payload.userId })
  }

  await next()
}
