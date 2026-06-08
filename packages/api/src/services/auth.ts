import { getMockCurrentUser, loginWithMockCode } from "@sast-shop/mocks"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError } from "../errors"

export interface CurrentUser {
  id: string
  name: string
  department: string
  avatarUrl: string
}

export interface AuthSession {
  sessionToken: string
  expiresAt: string
  user: CurrentUser
}

export async function getCurrentUser(options: ServiceOptions = {}): Promise<CurrentUser> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    const user = getMockCurrentUser()

    return {
      id: user.id,
      name: user.name,
      department: user.department,
      avatarUrl: user.avatarUrl,
    }
  }

  throw new FeatureUnavailableError("getCurrentUser")
}

export async function loginWithLarkCode(
  code: string,
  options: ServiceOptions = {}
): Promise<AuthSession> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    const session = loginWithMockCode(code)

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        name: session.user.name,
        department: session.user.department,
        avatarUrl: session.user.avatarUrl,
      },
    }
  }

  throw new FeatureUnavailableError("loginWithLarkCode")
}
