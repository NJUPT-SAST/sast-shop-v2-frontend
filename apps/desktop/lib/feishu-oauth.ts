export const defaultFeishuOAuthAuthorizeUrl =
  "https://accounts.feishu.cn/open-apis/authen/v1/authorize";
export const feishuOAuthStateCookieName = "sast_shop_feishu_oauth_state";
export const feishuOAuthStateCookiePath = "/auth/callback";
export const feishuOAuthStateMaxAgeSeconds = 10 * 60;

const maxAppIdLength = 128;
const maxReturnToLength = 2048;
const maxStateLength = 3072;

export interface FeishuOAuthConfig {
  appId: string;
  redirectUri: string;
  authorizeUrl: string;
}

export interface FeishuOAuthState {
  nonce: string;
  returnTo: string;
  issuedAt: number;
}

export function resolveFeishuOAuthConfig({
  appId,
  redirectUri,
  appOrigin,
  authorizeUrl = defaultFeishuOAuthAuthorizeUrl,
  production = false,
}: {
  appId: string | undefined;
  redirectUri: string | undefined;
  appOrigin: string;
  authorizeUrl?: string;
  production?: boolean;
}): FeishuOAuthConfig {
  const normalizedAppId = appId?.trim() ?? "";
  if (
    !normalizedAppId.startsWith("cli_") ||
    normalizedAppId.length > maxAppIdLength ||
    !/^cli_[A-Za-z0-9_-]+$/.test(normalizedAppId)
  ) {
    throw new Error("FEISHU_APP_ID is not configured or invalid");
  }

  const origin = normalizeAppOrigin(appOrigin, production);
  const normalizedRedirectUri = normalizeRedirectUri(
    redirectUri ?? `${origin}/auth/callback`,
    origin,
    production,
  );
  const normalizedAuthorizeUrl = normalizeAuthorizeUrl(authorizeUrl);

  return {
    appId: normalizedAppId,
    redirectUri: normalizedRedirectUri,
    authorizeUrl: normalizedAuthorizeUrl,
  };
}

export function createFeishuOAuthAuthorizeUrl(
  config: FeishuOAuthConfig,
  state: string,
): URL {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

export function normalizeAuthReturnTo(
  value: string | null | undefined,
  fallback = "/shop",
): string {
  const raw = value?.trim();
  if (!raw || raw.length > maxReturnToLength) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\u0000-\u001F\\]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "http://app.local");
  } catch {
    return fallback;
  }

  if (url.origin !== "http://app.local") return fallback;
  if (url.pathname === "/auth/callback" || url.pathname.startsWith("/api/auth")) {
    return fallback;
  }

  return `${url.pathname}${url.search}`;
}

export function createFeishuOAuthState(
  returnTo: string,
  options: {
    nonce?: string;
    issuedAt?: number;
  } = {},
): string {
  const state: FeishuOAuthState = {
    nonce: options.nonce ?? createNonce(),
    returnTo: normalizeAuthReturnTo(returnTo),
    issuedAt: options.issuedAt ?? Date.now(),
  };
  return encodeBase64Url(JSON.stringify(state));
}

export function parseFeishuOAuthState(value: string): FeishuOAuthState | null {
  if (!value || value.length > maxStateLength) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const { nonce, returnTo, issuedAt } = parsed as Record<string, unknown>;
    if (
      typeof nonce !== "string" ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
      typeof returnTo !== "string" ||
      typeof issuedAt !== "number" ||
      !Number.isSafeInteger(issuedAt) ||
      issuedAt <= 0
    ) {
      return null;
    }

    return {
      nonce,
      returnTo: normalizeAuthReturnTo(returnTo),
      issuedAt,
    };
  } catch {
    return null;
  }
}

export function isFreshFeishuOAuthState(
  state: FeishuOAuthState,
  now = Date.now(),
): boolean {
  return (
    Number.isSafeInteger(now) &&
    state.issuedAt <= now &&
    now - state.issuedAt <= feishuOAuthStateMaxAgeSeconds * 1000
  );
}

function normalizeAppOrigin(value: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_ORIGIN is invalid");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (production && url.protocol !== "https:")
  ) {
    throw new Error("NEXT_PUBLIC_APP_ORIGIN is invalid");
  }

  return url.origin;
}

function normalizeRedirectUri(
  value: string,
  appOrigin: string,
  production: boolean,
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FEISHU_REDIRECT_URI is invalid");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname !== feishuOAuthStateCookiePath ||
    url.origin !== appOrigin ||
    (production && url.protocol !== "https:")
  ) {
    throw new Error("FEISHU_REDIRECT_URI is invalid");
  }

  return url.href;
}

function normalizeAuthorizeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FEISHU_OAUTH_AUTHORIZE_URL is invalid");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("FEISHU_OAUTH_AUTHORIZE_URL is invalid");
  }

  return url.href;
}

function createNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}
