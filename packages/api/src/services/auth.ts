import { createClient } from "@connectrpc/connect"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { AuthService } from "../gen/sast/sastshopv2/user/v1/auth_service_pb"
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb"
import { UserService } from "../gen/sast/sastshopv2/user/v1/user_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
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

export interface JSAPIAuthConfig {
  appId: string
  timestamp: string
  nonceStr: string
  signature: string
}

export async function getCurrentUser(options: ServiceOptions = {}): Promise<CurrentUser> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
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

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AuthService, createLocalTransport(options))
    const response = await requestLocal("loginWithLarkCode", () =>
      client.login({ code })
    )

    if (!response.userInfo || !response.expiresAt || !response.sessionToken.trim()) {
      throw new FeatureUnavailableError("loginWithLarkCode")
    }

    const expiresAt = timestampDate(response.expiresAt)
    if (expiresAt.getTime() <= Date.now()) {
      throw new FeatureUnavailableError("loginWithLarkCode")
    }

    return {
      sessionToken: response.sessionToken.trim(),
      expiresAt: expiresAt.toISOString(),
      user: mapUserInfo(response.userInfo),
    }
  }

  throw new FeatureUnavailableError("loginWithLarkCode")
}

export async function getJSAPIAuthConfig(
  signingUrl: string,
  options: ServiceOptions = {},
): Promise<JSAPIAuthConfig> {
  const url = normalizeJSAPISigningUrl(signingUrl)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AuthService, createLocalTransport(options))
    const response = await requestLocal("getJSAPIAuthConfig", () =>
      client.getJSAPIAuthConfig({ url }),
    )

    if (
      !response.appId.trim() ||
      !response.timestamp.trim() ||
      !response.nonceStr.trim() ||
      !response.signature.trim()
    ) {
      throw new FeatureUnavailableError("getJSAPIAuthConfig")
    }

    return {
      appId: response.appId,
      timestamp: response.timestamp,
      nonceStr: response.nonceStr,
      signature: response.signature,
    }
  }

  throw new FeatureUnavailableError("getJSAPIAuthConfig")
}

function normalizeJSAPISigningUrl(value: string): string {
  if (typeof value !== "string" || value.length > 4096) {
    throw new ValidationError("JSAPI 签名地址不正确")
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ValidationError("JSAPI 签名地址不正确")
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new ValidationError("JSAPI 签名地址不正确")
  }

  url.hash = ""
  return url.href
}

function mapUserInfo(userInfo: UserInfo): CurrentUser {
  return {
    id: userInfo.id.toString(),
    name: userInfo.name,
    avatarUrl: userInfo.avatarUrl,
  }
}
