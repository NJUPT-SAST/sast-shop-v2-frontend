import "server-only";
import { cookies } from "next/headers";
import {
  AdminAccessError,
  getAdminContext,
  type AdminOptions,
} from "@sast-shop/api";
import { sessionCookieName } from "@sast-shop/api/server";
import { getServerConnectBaseUrl } from "./server-service-options";

export async function getAdminServerOptions(): Promise<AdminOptions> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) throw new AdminAccessError(401, "请先通过飞书登录管理后台");
  const base = new URL(`${getServerConnectBaseUrl()}/`);
  return {
    connectBaseUrl: base.href.replace(/\/$/, ""),
    fetch: async (input, init) => {
      const target = new URL(
        input instanceof Request ? input.url : String(input),
      );
      if (
        target.origin !== base.origin ||
        !target.pathname.startsWith(base.pathname)
      ) {
        throw new Error("拒绝向非管理服务转发会话");
      }
      const headers = new Headers(
        input instanceof Request ? input.headers : init?.headers,
      );
      headers.delete("cookie");
      headers.delete("x-dev-user-id");
      headers.delete("x-west-pocket-token");
      headers.delete("x-admin-internal-token");
      headers.set("authorization", `Bearer ${token}`);
      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
        redirect: "manual",
      });
    },
  };
}

export async function requireAdmin() {
  const options = await getAdminServerOptions();
  return { identity: await getAdminContext(options), options };
}
