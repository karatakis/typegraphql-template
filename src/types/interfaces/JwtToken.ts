import { UserRole } from 'src/types/enums/UserRole'

export interface JwtToken {
  userId: string
  sessionId: string
  type: 'ACCESS' | 'REFRESH'
}

export interface AccessToken extends JwtToken {
  type: 'ACCESS'
  role: UserRole
}

export interface RefreshToken extends JwtToken {
  type: 'REFRESH'
  refreshToken: string
}
