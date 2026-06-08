import { createClient } from "@connectrpc/connect"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { getMockCurrentUser, loginWithMockCode } from "@sast-shop/mocks"
import { AuthService } from "../gen/sast/sastshopv2/user/v1/auth_service_pb"
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb"
import { UserService } from "../gen/sast/sastshopv2/user/v1/user_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

const LOCAL_SMOKE_USER_ID = 10001n

export interface CurrentUser {
  id: string
  name: string
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
      avatarUrl: user.avatarUrl,
    }
  }

  if (dataSource === "local") {
    const client = createClient(UserService, createLocalTransport(options))
    const response = await requestLocal("getCurrentUser", () =>
      client.getUserInfo({ userId: LOCAL_SMOKE_USER_ID })
    )

    if (!response.userInfo) {
      throw new FeatureUnavailableError("getCurrentUser")
    }

    return mapUserInfo(response.userInfo)
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
        avatarUrl: session.user.avatarUrl,
      },
    }
  }

  if (dataSource === "local") {
    const client = createClient(AuthService, createLocalTransport(options))
    const response = await requestLocal("loginWithLarkCode", () =>
      client.login({ code })
    )

    if (!response.userInfo || !response.expiresAt) {
      throw new FeatureUnavailableError("loginWithLarkCode")
    }

    return {
      sessionToken: response.sessionToken,
      expiresAt: timestampDate(response.expiresAt).toISOString(),
      user: mapUserInfo(response.userInfo),
    }
  }

  throw new FeatureUnavailableError("loginWithLarkCode")
}

function mapUserInfo(userInfo: UserInfo): CurrentUser {
  return {
    id: userInfo.id.toString(),
    name: userInfo.name,
    avatarUrl: userInfo.avatarUrl,
  }
}
