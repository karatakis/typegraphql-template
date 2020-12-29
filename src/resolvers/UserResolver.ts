import { UserInputError } from 'apollo-server'
import { Arg, Ctx, Mutation, Query, Resolver } from 'type-graphql'
import { EntityManager } from '@mikro-orm/core'
import { hash, compare } from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'
import { v4 } from 'uuid'
import {
  ResetToken,
  Session,
  User,
  VerifyToken
} from 'src/types/entities'
import {
  RegisterInput,
  ResetPasswordInput,
  TokensObject,
  LoginInput
} from 'src/types/classes'
import { mailQueue } from 'src/dependencies/Queues'
import { APP_NAME, JWT_SECRET } from 'src/dependencies/Config'
import { AccessToken, RefreshToken } from 'src/types/interfaces/JwtToken'
import { NotFoundErrorEnum, UserErrorEnum } from 'src/types/enums/Errors'
import { isValidEmail, isValidUUID } from 'src/dependencies/Guards'

function makeTokensObject (session: Session, remember: boolean): TokensObject {
  const payload = new TokensObject()

  const accessTokenPayload: AccessToken = {
    userId: session.user.id,
    sessionId: session.id,
    role: session.user.role,
    type: 'ACCESS'
  }
  const accessToken = sign(accessTokenPayload, JWT_SECRET, { expiresIn: '15m' })
  payload.accessToken = accessToken

  if (remember && session.refreshToken !== undefined) {
    const refreshTokenPayload: RefreshToken = {
      userId: session.user.id,
      sessionId: session.id,
      refreshToken: session.refreshToken,
      type: 'REFRESH'
    }

    const refreshToken = sign(refreshTokenPayload, JWT_SECRET, { expiresIn: '7d' })
    payload.refreshToken = refreshToken
  }

  return payload
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  me (
    @Ctx('user') user?: User
  ): User | undefined {
    return user
  }

  @Mutation(() => User)
  async register (
    @Ctx('em') em: EntityManager,
      @Arg('data') data: RegisterInput
  ): Promise<User> {
    const existingUser = await em.findOne(User, { email: data.email })
    if (existingUser !== null) {
      throw new UserInputError(UserErrorEnum.EMAIL_ALREADY_IN_USE)
    }

    const user = new User()

    user.name = data.name
    user.email = data.email
    user.password = await hash(data.password, 10)

    const verifyToken = em.create(VerifyToken, {
      user
    })

    await mailQueue.add({
      address: user.email,
      subject: `${APP_NAME}: email verification`,
      body: `Pease verify your email, your token is "${verifyToken.id}"`
    })

    await em.persistAndFlush([user, verifyToken])

    return user
  }

  @Mutation(() => User)
  async verifyEmail (
    @Ctx('em') em: EntityManager,
      @Arg('token') token: string
  ): Promise<User> {
    isValidUUID(token)
    const verifyToken = await em.findOne(VerifyToken, { id: token }, ['user'])
    if (verifyToken === null) {
      throw new UserInputError(NotFoundErrorEnum.VERIFY_TOKEN)
    }

    const user = verifyToken.user

    // used to prevent users from being verified again
    if (user.emailVerifiedAt === undefined) {
      user.emailVerifiedAt = new Date()

      em.persist(user)

      await mailQueue.add({
        address: user.email,
        subject: `${APP_NAME}: email verified`,
        body: 'Your email has been verified'
      })
    }

    em.remove(verifyToken)

    await em.flush()

    return user
  }

  @Mutation(() => Boolean)
  async resendVerifyEmail (
    @Ctx('em') em: EntityManager,
      @Arg('email') email: string
  ): Promise<boolean> {
    isValidEmail(email)

    const user = await em.findOne(User, { email }, ['verifyToken'])
    if (user === null) {
      throw new UserInputError(NotFoundErrorEnum.USER)
    }

    // used to prevent users from being verified again
    if (user.emailVerifiedAt !== undefined) {
      throw new UserInputError(UserErrorEnum.USER_EMAIL_VERIFIED)
    }

    // used to create new verify token if previous one expired
    if (user.verifyToken === undefined) {
      const verifyToken = em.create(VerifyToken, {
        user: user
      })
      user.verifyToken = verifyToken
      em.persist([verifyToken, user])
    }

    const verifyToken = user.verifyToken

    await mailQueue.add({
      address: user.email,
      subject: `${APP_NAME}: email verification`,
      body: `Pease verify your email, your token is "${verifyToken.id}"`
    })

    await em.flush()

    return true
  }

  @Mutation(() => Boolean)
  async requestReset (
    @Ctx('em') em: EntityManager,
      @Arg('email') email: string
  ): Promise<boolean> {
    isValidEmail(email)

    const user = await em.findOne(User, { email })
    if (user === null) {
      throw new UserInputError(NotFoundErrorEnum.USER)
    }

    const resetToken = em.create(ResetToken, {
      user
    })

    await mailQueue.add({
      address: user.email,
      subject: `${APP_NAME}: password reset`,
      body: `Your password reset token is "${resetToken.id}"`
    })

    await em.persistAndFlush([resetToken])

    return true
  }

  @Mutation(() => Boolean)
  async resetPassword (
    @Ctx('em') em: EntityManager,
      @Arg('data') data: ResetPasswordInput
  ): Promise<boolean> {
    const resetToken = await em.findOne(ResetToken, { id: data.token }, ['user'])
    if (resetToken === null) {
      throw new UserInputError(NotFoundErrorEnum.RESET_TOKEN)
    }
    const user = resetToken.user

    user.password = await hash(data.password, 10)

    em.remove(resetToken)
    em.persist(user)

    await mailQueue.add({
      address: user.email,
      subject: `${APP_NAME}: password changed`,
      body: 'Your account password has changed'
    })

    await em.flush()

    return true
  }

  @Mutation(() => TokensObject)
  async login (
    @Ctx('em') em: EntityManager,
      @Arg('data') data: LoginInput
  ): Promise<TokensObject> {
    const user = await em.findOne(User, { email: data.email })
    if (user === null) {
      throw new UserInputError(NotFoundErrorEnum.USER)
    }

    if (user.emailVerifiedAt === undefined) {
      throw new UserInputError(UserErrorEnum.USER_NOT_VERIFIED)
    }

    const isPasswordValid = await compare(data.password, user.password)

    if (!isPasswordValid) {
      throw new UserInputError(UserErrorEnum.INVALID_PASSWORD)
    }

    const session = em.create(Session, {
      user,
      refreshToken: data.remember ? v4() : undefined
    })
    em.persist(session)

    const payload = makeTokensObject(session, data.remember)

    await em.flush()

    return payload
  }

  @Mutation(() => TokensObject)
  async refreshToken (
    @Ctx('em') em: EntityManager,
      @Arg('token') token: string
  ): Promise<TokensObject> {
    const data = verify(token, JWT_SECRET) as RefreshToken

    const session = await em.findOne(Session, { id: data.sessionId }, ['user'])
    if (session === null) {
      throw new UserInputError(NotFoundErrorEnum.SESSION)
    }

    if (session.refreshToken !== data.refreshToken) {
      throw new UserInputError(UserErrorEnum.INVALID_REFRESH_TOKEN)
    }

    if (data.userId !== session.user.id) {
      throw new UserInputError(UserErrorEnum.INTERNAL_ERROR)
    }

    session.refreshToken = v4()

    const payload = makeTokensObject(session, true)

    await em.persistAndFlush(session)

    return payload
  }

  @Query(() => [Session])
  async sessions (
    @Ctx('user') user: User
  ): Promise<Session[]> {
    await user.sessions.init()
    return user.sessions.getItems()
  }

  @Mutation(() => Boolean)
  async killSessions (
    @Ctx('em') em: EntityManager,
      @Ctx('user') user: User
  ): Promise<boolean> {
    user
      .sessions
      .getItems()
      .forEach(session => {
        em.remove(session)
      })

    await em.flush()

    return true
  }

  @Mutation(() => Boolean)
  async killSession (
    @Ctx('em') em: EntityManager,
      @Ctx('user') user: User,
      @Arg('session') sessionId: string
  ): Promise<boolean> {
    isValidUUID(sessionId)

    const session = await em.findOne(Session, { id: sessionId })

    if (session === null || session.user.id !== user.id) {
      throw new UserInputError(NotFoundErrorEnum.SESSION)
    }

    await em.removeAndFlush(session)

    return true
  }
}
