import { EntityManager } from '@mikro-orm/core'
import { UserInputError } from 'apollo-server'
import { JsonWebTokenError, sign, TokenExpiredError, verify } from 'jsonwebtoken'
import { JWT_SECRET } from 'src/dependencies/Config'
import { mailQueue } from 'src/dependencies/Queues'
import { UserResolver } from 'src/resolvers'
import { ResetToken, User, VerifyToken, Session } from 'src/types/entities'
import { NotFoundErrorEnum, UserErrorEnum } from 'src/types/enums/Errors'
import { UserRole } from 'src/types/enums/UserRole'
import { AccessToken, RefreshToken } from 'src/types/interfaces/JwtToken'
import { closeConnection, getConnection } from 'tests/DatabaseUtils'

beforeAll(async () => {
  await getConnection()
})

afterAll(async () => {
  await closeConnection()
})

let em: EntityManager
beforeEach(async () => {
  await mailQueue.removeJobs('*')
  em = (await getConnection()).em.fork()
  await em.begin()
})

afterEach(async () => {
  await mailQueue.removeJobs('*')
  await em.rollback()
})

async function sleep (time: number): Promise<void> {
  return await new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

async function createFakeUser (isVerified = false): Promise<User> {
  const user = em.create(User, {
    name: 'Example User',
    email: 'example@example.com',
    password: '$2a$10$PNnhGbaL.Wmy83VGpid3TOwPv1vKUkqszvmUog2Uv6SLY9MypnQUK', // password
    emailVerifiedAt: isVerified ? new Date() : undefined
  })
  await em.persistAndFlush(user)
  return user
}

describe('userResolver', () => {
  const userResolver = new UserResolver()

  describe('me', () => {
    test('result undefined', () => {
      const result = userResolver.me()
      expect(result).toBeUndefined()
    })

    test('normal', async () => {
      expect.assertions(1)
      const user = await createFakeUser()
      const result = userResolver.me(user)
      expect(result).toBe(user)
    })
  })

  describe('register', () => {
    test('normal', async () => {
      expect.assertions(8)

      const email = 'example@example.com'
      const name = 'Example User'
      const password = 'password'

      const userResult = await userResolver.register(em, {
        email,
        name,
        password
      })
      const userQuery = await em.findOneOrFail(User, { email })

      expect(userResult).toBe(userQuery)

      expect(userResult.email).toBe(email)
      expect(userResult.name).toBe(name)
      expect(userResult.emailVerifiedAt).toBeUndefined()
      expect(userResult.role).toBe(UserRole.USER)
      expect(userResult.password).not.toBe(password)

      expect(userResult.verifyToken).not.toBeUndefined()

      expect(await mailQueue.count()).toBe(1)
    })

    test('exists', async () => {
      expect.assertions(2)
      await createFakeUser()

      const email = 'example@example.com'
      const name = 'Example User'
      const password = 'password'

      const promise = userResolver.register(em, {
        email,
        name,
        password
      })

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.EMAIL_ALREADY_IN_USE)
    })
  })

  describe('verifyEmail', () => {
    test('invalid verification token', async () => {
      expect.assertions(2)

      const promise = userResolver.verifyEmail(em, '1234')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.TOKEN_NOT_VALID_UUID)
    })

    test('missing verification token', async () => {
      expect.assertions(2)

      const promise = userResolver.verifyEmail(em, 'e0c02248-0397-40c9-b8e5-b7e0e9fe79df')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.VERIFY_TOKEN)
    })

    test('validate user', async () => {
      expect.assertions(4)
      const user = await createFakeUser()
      expect(user.emailVerifiedAt).toBeUndefined()
      const token = em.create(VerifyToken, {
        user
      })
      await em.persistAndFlush(token)

      const newUser = await userResolver.verifyEmail(em, token.id)
      expect(newUser.emailVerifiedAt).not.toBeUndefined()
      expect(newUser.id).toBe(user.id)
      expect(await mailQueue.count()).toBe(1)
    })

    test('should not revalidate user', async () => {
      expect.assertions(3)
      const user = await createFakeUser(true)
      const token = em.create(VerifyToken, {
        user
      })
      await em.persistAndFlush(token)

      const newUser = await userResolver.verifyEmail(em, token.id)
      expect(newUser.id).toBe(user.id)
      expect(newUser.emailVerifiedAt).toBe(user.emailVerifiedAt)
      expect(await mailQueue.count()).toBe(0)
    })
  })

  describe('resendVerifyEmail', () => {
    test('invalid email', async () => {
      expect.assertions(2)

      const promise = userResolver.resendVerifyEmail(em, 'dummy')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.INVALID_EMAIL)
    })

    test('user not found', async () => {
      expect.assertions(2)

      const promise = userResolver.resendVerifyEmail(em, 'example@example.com')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.USER)
    })

    test('user already verified', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)

      const promise = userResolver.resendVerifyEmail(em, user.email)
      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.USER_EMAIL_VERIFIED)
    })

    test('creation of verification token', async () => {
      expect.assertions(6)

      const user = await createFakeUser()

      expect(user.emailVerifiedAt).toBeUndefined()
      expect(user.verifyToken).toBeUndefined()

      await userResolver.resendVerifyEmail(em, user.email)
      const newUser = await em.findOneOrFail(User, user.id, ['verifyToken'])

      expect(newUser.id).toBe(user.id)
      expect(newUser.verifyToken).not.toBeUndefined()
      expect(newUser.emailVerifiedAt).toBeUndefined()
      expect(await mailQueue.count()).toBe(1)
    })

    test('resend existing token', async () => {
      expect.assertions(5)

      const user = await createFakeUser()
      expect(user.emailVerifiedAt).toBeUndefined()
      const token = em.create(VerifyToken, {
        user
      })
      await em.persistAndFlush(token)

      await userResolver.resendVerifyEmail(em, user.email)
      const newUser = await em.findOneOrFail(User, user.id, ['verifyToken'])

      expect(newUser.id).toBe(user.id)
      expect(newUser.emailVerifiedAt).toBeUndefined()
      expect(newUser.verifyToken?.id).toBe(token.id)
      expect(await mailQueue.count()).toBe(1)
    })
  })

  describe('requestReset', () => {
    test('invalid email', async () => {
      expect.assertions(2)

      const promise = userResolver.requestReset(em, 'dummy')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.INVALID_EMAIL)
    })

    test('user not found', async () => {
      expect.assertions(2)

      const promise = userResolver.requestReset(em, 'example@example.com')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.USER)
    })

    test('send reset', async () => {
      expect.assertions(3)
      const user = await createFakeUser()

      expect(user.resetTokens.count()).toBe(0)

      await userResolver.requestReset(em, user.email)

      const newUser = await em.findOneOrFail(User, user.id, ['resetTokens'])

      expect(newUser.resetTokens.count()).toBe(1)
      expect(await mailQueue.count()).toBe(1)
    })

    test('send reset create two', async () => {
      expect.assertions(3)
      const user = await createFakeUser()

      expect(user.resetTokens.count()).toBe(0)

      await userResolver.requestReset(em, user.email)
      await userResolver.requestReset(em, user.email)

      const newUser = await em.findOneOrFail(User, user.id, ['resetTokens'])

      expect(newUser.resetTokens.count()).toBe(2)
      expect(await mailQueue.count()).toBe(2)
    })
  })

  describe('resetPassword', () => {
    test('reset token not found', async () => {
      expect.assertions(2)

      const promise = userResolver.resetPassword(em, {
        password: '12341234',
        token: '1234'
      })

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.RESET_TOKEN)
    })

    test('normal', async () => {
      const password = '12341234'
      const fakePassword = '$2a$10$PNnhGbaL.Wmy83VGpid3TOwPv1vKUkqszvmUog2Uv6SLY9MypnQUK'
      expect.assertions(4)
      const user = await createFakeUser()
      expect(user.password).toBe(fakePassword)
      const token = em.create(ResetToken, {
        user
      })
      await em.persistAndFlush(token)

      await userResolver.resetPassword(em, {
        password,
        token: token.id
      })

      const newUser = await em.findOneOrFail(User, user.id)

      expect(newUser.password).not.toBe(fakePassword)
      expect(newUser.password).not.toBe(password)
      expect(await mailQueue.count()).toBe(1)
    })
  })

  describe('login', () => {
    test('user not found', async () => {
      expect.assertions(2)

      const promise = userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: false
      })

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.USER)
    })

    test('user not verified', async () => {
      expect.assertions(3)
      const user = await createFakeUser()
      expect(user.emailVerifiedAt).toBeUndefined()

      const promise = userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: false
      })

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.USER_NOT_VERIFIED)
    })

    test('invalid password', async () => {
      expect.assertions(3)
      const user = await createFakeUser(true)
      expect(user.emailVerifiedAt).not.toBeUndefined()

      const promise = userResolver.login(em, {
        email: 'example@example.com',
        password: 'password1',
        remember: false
      })

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.INVALID_PASSWORD)
    })

    test('normal without remember', async () => {
      expect.assertions(8)
      const user = await createFakeUser(true)
      expect(user.emailVerifiedAt).not.toBeUndefined()

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: false
      })

      expect(user.sessions.count()).toBe(1)

      expect(payload.accessToken).not.toBeUndefined()
      expect(payload.refreshToken).toBeUndefined()

      const jwtPayload = verify(payload.accessToken, JWT_SECRET) as AccessToken

      expect(jwtPayload.role).toBe('user')
      expect(jwtPayload.type).toBe('ACCESS')
      expect(jwtPayload.userId).toBe(user.id)
      expect(jwtPayload.sessionId).toBe(user.sessions.getItems()[0].id)
    })

    test('normal with remember', async () => {
      expect.assertions(12)
      const user = await createFakeUser(true)
      expect(user.emailVerifiedAt).not.toBeUndefined()

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      expect(user.sessions.count()).toBe(1)

      expect(payload.accessToken).not.toBeUndefined()
      expect(payload.refreshToken).not.toBeUndefined()

      const accessPayload = verify(payload.accessToken, JWT_SECRET) as AccessToken
      const refreshPayload = verify(payload.refreshToken as string, JWT_SECRET) as RefreshToken

      expect(accessPayload.role).toBe('user')
      expect(accessPayload.type).toBe('ACCESS')
      expect(accessPayload.userId).toBe(user.id)
      expect(accessPayload.sessionId).toBe(user.sessions.getItems()[0].id)

      expect(refreshPayload.refreshToken).toBe(user.sessions.getItems()[0].refreshToken)
      expect(refreshPayload.type).toBe('REFRESH')
      expect(refreshPayload.userId).toBe(user.id)
      expect(refreshPayload.sessionId).toBe(user.sessions.getItems()[0].id)
    })
  })

  describe('refreshToken', () => {
    test('normal', async () => {
      expect.assertions(8)
      const user = await createFakeUser(true)

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      const refreshPayload = verify(payload.refreshToken as string, JWT_SECRET) as RefreshToken
      expect(refreshPayload.refreshToken).toBe(user.sessions.getItems()[0].refreshToken)

      const newPayload = await userResolver.refreshToken(em, payload.refreshToken as string)

      const newAccessPayload = verify(newPayload.accessToken, JWT_SECRET) as AccessToken
      const newRefreshPayload = verify(newPayload.refreshToken as string, JWT_SECRET) as RefreshToken

      expect(newRefreshPayload.type).toBe('REFRESH')
      expect(newRefreshPayload.sessionId).toBe(refreshPayload.sessionId)
      expect(newAccessPayload.type).toBe('ACCESS')
      expect(newAccessPayload.sessionId).toBe(refreshPayload.sessionId)
      expect(newAccessPayload.role).toBe('user')

      expect(newRefreshPayload.refreshToken).toBe(user.sessions.getItems()[0].refreshToken)
      expect(refreshPayload.refreshToken).not.toBe(newRefreshPayload.refreshToken)
    })

    test('expired sessions', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      user.sessions.getItems().map(session => {
        em.remove(session)
      })
      await em.persistAndFlush(user)

      const promise = userResolver.refreshToken(em, payload.refreshToken as string)

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.SESSION)
    })

    test('junky token', async () => {
      expect.assertions(2)

      const promise = userResolver.refreshToken(em, 'junk')

      await expect(promise).rejects.toThrow(JsonWebTokenError)
      await expect(promise).rejects.toThrow('jwt malformed')
    })

    test('expired token', async () => {
      expect.assertions(2)
      await createFakeUser(true)

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      const refreshPayload = verify(payload.refreshToken as string, JWT_SECRET) as RefreshToken

      const newRefreshToken = sign({
        userId: refreshPayload.userId,
        sessionId: refreshPayload.sessionId,
        refreshToken: refreshPayload.refreshToken,
        type: refreshPayload.type
      }, JWT_SECRET, { expiresIn: -100 })

      const promise = userResolver.refreshToken(em, newRefreshToken)

      await expect(promise).rejects.toThrow(TokenExpiredError)
      await expect(promise).rejects.toThrow('jwt expired')
    })

    test('corrupted token', async () => {
      expect.assertions(2)
      await createFakeUser(true)

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      const refreshPayload = verify(payload.refreshToken as string, JWT_SECRET) as RefreshToken

      const newRefreshToken = sign({
        userId: '1234-test-1234',
        sessionId: refreshPayload.sessionId,
        refreshToken: refreshPayload.refreshToken,
        type: refreshPayload.type
      }, JWT_SECRET, { expiresIn: 1 })

      await sleep(10)

      const promise = userResolver.refreshToken(em, newRefreshToken)

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.INTERNAL_ERROR)
    })

    test('refresh already refreshed session', async () => {
      expect.assertions(2)
      await createFakeUser(true)

      const payload = await userResolver.login(em, {
        email: 'example@example.com',
        password: 'password',
        remember: true
      })

      await userResolver.refreshToken(em, payload.refreshToken as string)
      const promise = userResolver.refreshToken(em, payload.refreshToken as string)

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.INVALID_REFRESH_TOKEN)
    })
  })

  describe('sessions', () => {
    test('empty', async () => {
      expect.assertions(1)
      const user = await createFakeUser(true)

      const result = await userResolver.sessions(user)

      expect(result).toHaveLength(0)
    })

    test('normal', async () => {
      expect.assertions(3)
      const user = await createFakeUser(true)

      const session1 = em.create(Session, {
        user
      })

      const session2 = em.create(Session, {
        user
      })

      const sessionIds = [session1.id, session2.id]

      await em.persistAndFlush([session1, session2])

      const result = await userResolver.sessions(user)

      expect(sessionIds.includes(result[0].id)).toBeTruthy()
      expect(sessionIds.includes(result[1].id)).toBeTruthy()
      expect(result).toHaveLength(2)
    })
  })

  describe('killSessions', () => {
    test('normal', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)
      const session1 = em.create(Session, {
        user
      })
      const session2 = em.create(Session, {
        user
      })
      await em.persistAndFlush([session1, session2])

      const result = await userResolver.sessions(user)
      expect(result).toHaveLength(2)

      await userResolver.killSessions(em, user)

      const newResult = await userResolver.sessions(user)
      expect(newResult).toHaveLength(0)
    })

    test('empty', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)

      const result = await userResolver.sessions(user)
      expect(result).toHaveLength(0)

      await userResolver.killSessions(em, user)

      const newResult = await userResolver.sessions(user)
      expect(newResult).toHaveLength(0)
    })
  })

  describe('killSession', () => {
    test('invalid uuid', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)

      const promise = userResolver.killSession(em, user, 'abcd')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(UserErrorEnum.TOKEN_NOT_VALID_UUID)
    })

    test('invalid session', async () => {
      expect.assertions(2)
      const user = await createFakeUser(true)

      const promise = userResolver.killSession(em, user, '529296c4-b37b-4d7d-97f1-a1381e485c80')

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.SESSION)
    })

    test('session belongs to other user', async () => {
      expect.assertions(2)
      const user1 = em.create(User, {
        name: 'Example User',
        email: 'example1@example.com',
        password: '$2a$10$PNnhGbaL.Wmy83VGpid3TOwPv1vKUkqszvmUog2Uv6SLY9MypnQUK', // password
        emailVerifiedAt: new Date()
      })
      const user2 = em.create(User, {
        name: 'Example User',
        email: 'example2@example.com',
        password: '$2a$10$PNnhGbaL.Wmy83VGpid3TOwPv1vKUkqszvmUog2Uv6SLY9MypnQUK', // password
        emailVerifiedAt: new Date()
      })
      const session = em.create(Session, {
        user: user1
      })
      await em.persistAndFlush([user1, user2, session])

      const promise = userResolver.killSession(em, user2, session.id)

      await expect(promise).rejects.toThrow(UserInputError)
      await expect(promise).rejects.toThrow(NotFoundErrorEnum.SESSION)
    })

    test('normal', async () => {
      expect.assertions(3)
      const user = await createFakeUser(true)
      const session1 = em.create(Session, {
        user
      })
      const session2 = em.create(Session, {
        user
      })
      await em.persistAndFlush([session1, session2])

      const result = await userResolver.sessions(user)
      expect(result).toHaveLength(2)

      await userResolver.killSession(em, user, session1.id)

      const newResult = await userResolver.sessions(user)
      expect(newResult).toHaveLength(1)
      expect(newResult[0].id).toBe(session2.id)
    })
  })
})
