import { createClient } from "@connectrpc/connect";
import { AuthService } from "../gen/sast/sastshopv2/user/v1/auth_service_pb";
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb";
import { UserService } from "../gen/sast/sastshopv2/user/v1/user_service_pb";
import {
  resolveDataSource,
  type CurrentUser,
  type ServiceOptions,
} from "../data-source";
import {
  AuthRequiredError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";

const LOCAL_SMOKE_USER_ID = 10001n;

export type { CurrentUser } from "../data-source";

export interface AuthSession {
  sessionToken: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface LoginWithLarkCodeOptions extends ServiceOptions {
  redirectUri?: string;
}

export interface JSAPIAuthConfig {
  appId: string;
  timestamp: string;
  nonceStr: string;
  signature: string;
}

export async function getCurrentUser(
  options: ServiceOptions = {},
): Promise<CurrentUser> {
  if (options.currentUser) return options.currentUser;
  if (options.requiresAuthenticatedUser) throw new AuthRequiredError();

  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(UserService, createLocalTransport(options));
    const response = await requestLocal("getCurrentUser", () =>
      client.getUserInfo({ userId: LOCAL_SMOKE_USER_ID }),
    );

    if (!response.userInfo) {
      throw new FeatureUnavailableError("getCurrentUser");
    }

    return mapUserInfo(response.userInfo);
  }

  throw new FeatureUnavailableError("getCurrentUser");
}

export async function validateSessionUser(
  userId: string,
  options: ServiceOptions = {},
): Promise<void> {
  if (!/^\d+$/.test(userId)) throw new ValidationError("用户 ID 不正确");
  const parsedUserId = BigInt(userId);
  if (parsedUserId <= 0n || parsedUserId > 9_223_372_036_854_775_807n) {
    throw new ValidationError("用户 ID 不正确");
  }

  const dataSource = resolveDataSource(options);
  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(UserService, createLocalTransport(options));
    const response = await requestLocal("validateSessionUser", () =>
      client.getUserInfo({ userId: parsedUserId }),
    );
    if (!response.userInfo || response.userInfo.id !== parsedUserId) {
      throw new AuthRequiredError();
    }
    return;
  }

  throw new FeatureUnavailableError("validateSessionUser");
}

export async function loginWithLarkCode(
  code: string,
  options: LoginWithLarkCodeOptions = {},
): Promise<AuthSession> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AuthService, createLocalTransport(options));
    const request = {
      code,
      ...(options.redirectUri !== undefined
        ? { redirectUri: normalizeLoginRedirectUri(options.redirectUri) }
        : {}),
    };
    const response = await requestLocal("loginWithLarkCode", () =>
      client.login(request),
    );

    if (
      !response.member ||
      !response.accessToken.trim() ||
      response.expiresIn <= 0
    ) {
      throw new FeatureUnavailableError("loginWithLarkCode");
    }

    const expiresAt = new Date(Date.now() + response.expiresIn * 1000);

    return {
      sessionToken: response.accessToken.trim(),
      expiresAt: expiresAt.toISOString(),
      user: {
        id: response.member.id.toString(),
        name: response.member.displayName,
        avatarUrl: response.member.avatarUrl,
      },
    };
  }

  throw new FeatureUnavailableError("loginWithLarkCode");
}

function normalizeLoginRedirectUri(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4096) {
    throw new ValidationError("登录回调地址不正确");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("登录回调地址不正确");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new ValidationError("登录回调地址不正确");
  }

  return url.href;
}

export async function getJSAPIAuthConfig(
  signingUrl: string,
  options: ServiceOptions = {},
): Promise<JSAPIAuthConfig> {
  const url = normalizeJSAPISigningUrl(signingUrl);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AuthService, createLocalTransport(options));
    const response = await requestLocal("getJSAPIAuthConfig", () =>
      client.getJSAPIAuthConfig({ url }),
    );

    if (
      !response.appId.trim() ||
      !response.timestamp.trim() ||
      !response.nonceStr.trim() ||
      !response.signature.trim()
    ) {
      throw new FeatureUnavailableError("getJSAPIAuthConfig");
    }

    return {
      appId: response.appId,
      timestamp: response.timestamp,
      nonceStr: response.nonceStr,
      signature: response.signature,
    };
  }

  throw new FeatureUnavailableError("getJSAPIAuthConfig");
}

function normalizeJSAPISigningUrl(value: string): string {
  if (typeof value !== "string" || value.length > 4096) {
    throw new ValidationError("JSAPI 签名地址不正确");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("JSAPI 签名地址不正确");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new ValidationError("JSAPI 签名地址不正确");
  }

  url.hash = "";
  return url.href;
}

function mapUserInfo(userInfo: UserInfo): CurrentUser {
  return {
    id: userInfo.id.toString(),
    name: userInfo.name,
    avatarUrl: userInfo.avatarUrl,
  };
}
