import type { CurrentUser } from "../data-source";

export const sessionCookieName = "sast_shop_session";
export const sessionUserCookieName = "sast_shop_session_user";

const maxCookieLength = 3_500;
const minSessionSecretLength = 32;

export function getSessionCookieSecret(
  value = process.env.SESSION_COOKIE_SECRET,
): string {
  if (!value || value.length < minSessionSecretLength) {
    throw new Error(
      "SESSION_COOKIE_SECRET must contain at least 32 characters",
    );
  }
  return value;
}

export async function createSessionUserCookie(
  user: CurrentUser,
  sessionToken: string,
  expiresAt: string,
  sessionSecret: string,
): Promise<string> {
  const normalized = normalizeCurrentUser(user);
  if (
    !normalized ||
    !sessionToken ||
    !isFutureExpiration(expiresAt, Date.now()) ||
    sessionSecret.length < minSessionSecretLength
  )
    throw new Error("Invalid OAuth user session");

  const payload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({ user: normalized, expiresAt })),
  );
  const signature = await sign(payload, sessionToken, sessionSecret);
  const cookie = `${payload}.${signature}`;
  if (cookie.length > maxCookieLength)
    throw new Error("OAuth user is too large");
  return cookie;
}

export async function readSessionUserCookie(
  cookie: string | undefined,
  sessionToken: string | undefined,
  sessionSecret: string,
  now = Date.now(),
): Promise<CurrentUser | null> {
  if (
    !cookie ||
    !sessionToken ||
    sessionSecret.length < minSessionSecretLength ||
    cookie.length > maxCookieLength
  )
    return null;
  const parts = cookie.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    const valid = await verify(parts[0], parts[1], sessionToken, sessionSecret);
    if (!valid) return null;
    const value = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(parts[0])),
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const { user, expiresAt } = value as Record<string, unknown>;
    if (typeof expiresAt !== "string" || !isFutureExpiration(expiresAt, now)) {
      return null;
    }
    return normalizeCurrentUser(user);
  } catch {
    return null;
  }
}

function isFutureExpiration(value: string, now: number) {
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function normalizeCurrentUser(value: unknown): CurrentUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, name, avatarUrl } = value as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 128 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 256 ||
    typeof avatarUrl !== "string" ||
    avatarUrl.length > 2_048
  ) {
    return null;
  }
  return { id: id.trim(), name: name.trim(), avatarUrl };
}

async function sign(
  payload: string,
  sessionToken: string,
  sessionSecret: string,
) {
  const key = await importKey(sessionSecret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${sessionToken}.${payload}`),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

async function verify(
  payload: string,
  signature: string,
  sessionToken: string,
  sessionSecret: string,
) {
  const key = await importKey(sessionSecret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${sessionToken}.${payload}`),
  );
}

function importKey(sessionSecret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
