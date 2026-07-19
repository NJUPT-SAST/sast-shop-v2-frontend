import "server-only";

import type { ServiceOptions } from "@sast-shop/api";
import {
  getSessionCookieSecret,
  readSessionUserCookie,
  sessionCookieName,
  sessionUserCookieName,
} from "@sast-shop/api/server";
import { cookies } from "next/headers";

import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export async function getServerServiceOptions(): Promise<ServiceOptions> {
  const options = {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  };

  if (getServerAuthMode() !== "required") return options;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const currentUser = await readSessionUserCookie(
    cookieStore.get(sessionUserCookieName)?.value,
    sessionToken,
    getSessionCookieSecret(),
  );
  if (!sessionToken) return { ...options, requiresAuthenticatedUser: true };

  const connectUrl = new URL("/api/connect", mobileAppConfig.appOrigin);
  const connectPath = connectUrl.pathname.endsWith("/")
    ? connectUrl.pathname
    : `${connectUrl.pathname}/`;

  return {
    ...options,
    currentUser: currentUser ?? undefined,
    requiresAuthenticatedUser: true,
    connectBaseUrl: connectUrl.href.replace(/\/$/, ""),
    fetch: async (input, init) => {
      const target = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );

      if (
        target.origin !== connectUrl.origin ||
        !target.pathname.startsWith(connectPath)
      ) {
        throw new Error("拒绝向非 Connect 代理目标转发会话");
      }

      const headers = new Headers(
        input instanceof Request ? input.headers : init?.headers,
      );
      headers.set(
        "cookie",
        `${sessionCookieName}=${encodeURIComponent(sessionToken)}`,
      );
      headers.set("origin", mobileAppConfig.appOrigin);

      return fetch(input, { ...init, headers, redirect: "manual" });
    },
  };
}

export async function getDirectServerServiceOptions(): Promise<ServiceOptions> {
  const connectBaseUrl = getServerConnectBaseUrl();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const authRequired = getServerAuthMode() === "required";
  const currentUser = authRequired
    ? await readSessionUserCookie(
        cookieStore.get(sessionUserCookieName)?.value,
        sessionToken,
        getSessionCookieSecret(),
      )
    : null;

  if (authRequired && !sessionToken) {
    throw new Error("Authentication required");
  }

  const connectUrl = new URL(connectBaseUrl);
  const connectPath = connectUrl.pathname.endsWith("/")
    ? connectUrl.pathname
    : `${connectUrl.pathname}/`;

  return {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl,
    currentUser: currentUser ?? undefined,
    requiresAuthenticatedUser: authRequired,
    fetch: async (input, init) => {
      const target = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (
        target.origin !== connectUrl.origin ||
        !target.pathname.startsWith(connectPath)
      ) {
        throw new Error("拒绝向非 Connect 上游转发会话");
      }

      const headers = new Headers(
        input instanceof Request ? input.headers : init?.headers,
      );
      headers.delete("cookie");
      headers.delete("authorization");
      if (sessionToken) headers.set("authorization", `Bearer ${sessionToken}`);

      return fetch(input, { ...init, headers, redirect: "manual" });
    },
  };
}

export function getServerConnectBaseUrl(): string {
  const configured =
    process.env.CONNECT_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : process.env.NEXT_PUBLIC_CONNECT_BASE_URL);
  if (!configured) throw new Error("CONNECT_BASE_URL is not configured");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("CONNECT_BASE_URL is invalid");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("CONNECT_BASE_URL is invalid");
  }

  return url.href.replace(/\/$/, "");
}
