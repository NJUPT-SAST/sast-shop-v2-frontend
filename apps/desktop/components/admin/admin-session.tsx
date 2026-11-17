"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  isLarkClientEnvironment,
  type AdminIdentity,
  type AdminOptions,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { RiShieldCheckLine } from "@remixicon/react";
import { safeAdminReturnTo } from "@/lib/admin-navigation";

const SessionContext = createContext<{
  identity: AdminIdentity;
  options: AdminOptions;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);
export function useAdminSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Admin session is required");
  return value;
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [state, setState] = useState<
    "checking" | "login" | "denied" | "error" | "ready"
  >("checking");
  const [message, setMessage] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const options = useMemo<AdminOptions>(
    () => ({
      connectBaseUrl:
        typeof window === "undefined"
          ? "/api/admin/connect"
          : `${window.location.origin}/api/admin/connect`,
    }),
    [],
  );
  const refresh = useCallback(async () => {
    const epoch = ++generation.current;
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const result = await response.json();
      if (!alive.current || epoch !== generation.current) return;
      if (!response.ok) {
        setIdentity(null);
        setMessage(result.error || "暂时无法核实管理员权限");
        setState(
          response.status === 401
            ? "login"
            : response.status === 403
              ? "denied"
              : "error",
        );
        return;
      }
      const next = result.identity as AdminIdentity;
      if (
        !next?.id ||
        !["admin", "superadmin"].includes(next.role) ||
        next.status !== "active"
      )
        throw new Error("管理员身份无效");
      setIdentity(next);
      setMessage("");
      setState("ready");
    } catch (error) {
      if (!alive.current || epoch !== generation.current) return;
      setIdentity(null);
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "暂时无法核实管理员权限",
      );
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const probe = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", probe);
    window.addEventListener("sast-shop:admin-access-changed", probe);
    document.addEventListener("visibilitychange", probe);
    const timer = window.setInterval(probe, 30_000);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", probe);
      window.removeEventListener("sast-shop:admin-access-changed", probe);
      document.removeEventListener("visibilitychange", probe);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [pathname, refresh]);
  const logout = useCallback(async () => {
    generation.current++;
    setIdentity(null);
    setState("checking");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("退出登录失败，请重试");
      window.dispatchEvent(new Event("sast-shop:session-changing"));
      setState("login");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "退出登录失败");
    }
  }, []);
  function login() {
    if (loggingIn) return;
    setLoggingIn(true);
    setMessage("");
    try {
      const returnTo = safeAdminReturnTo(
        `${window.location.pathname}${window.location.search}`,
      );
      const entry = isLarkClientEnvironment(window.h5sdk)
        ? "/"
        : "/api/auth/lark/authorize";
      const destination = new URL(entry, window.location.origin);
      destination.searchParams.set("returnTo", returnTo);
      window.location.assign(destination.href);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败，请重试");
    } finally {
      setLoggingIn(false);
    }
  }
  if (state === "ready" && identity) {
    return (
      <SessionContext.Provider
        key={`${identity.id}:${identity.authVersion}:${identity.role}`}
        value={{ identity, refresh, logout, options }}
      >
        {children}
      </SessionContext.Provider>
    );
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-7 shadow-sm">
        <RiShieldCheckLine className="mb-5 size-9 text-primary" />
        <h1 className="text-xl font-semibold">SAST 商城管理后台</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {state === "checking"
            ? "正在核实管理员身份…"
            : state === "denied"
              ? "此账号没有后台访问权限，或账号已被停用"
              : "使用飞书账号登录，系统将核实管理员权限"}
        </p>
        {message ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {state === "login" ? (
            <Button disabled={loggingIn} onClick={() => void login()}>
              {loggingIn ? "正在登录…" : "飞书登录"}
            </Button>
          ) : null}
          {state === "error" || state === "denied" ? (
            <Button onClick={() => void refresh()}>重新核实</Button>
          ) : null}
          {state === "denied" ? (
            <Button variant="outline" onClick={() => void logout()}>
              更换账号
            </Button>
          ) : null}
          <Button variant="ghost" asChild>
            <a href="/shop">返回商城</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
