"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AuthRequiredError,
  requestLarkAuthorizationCode,
  type DataSource,
  validateSessionUser,
} from "@sast-shop/api";
import { RiShieldUserLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";
import { waitForLarkLoginClient } from "@/lib/lark-login-client";

type AuthState = "checking" | "authenticating" | "authenticated" | "error";
const staleRequestWindowMs = 15_000;
const sessionProbeIntervalMs = 30_000;
const sessionProbeEventName = "sast-shop:probe-session";

export function AuthBootstrap({
  enabled,
  appId,
  dataSource,
  connectBaseUrl,
  children,
}: {
  enabled: boolean;
  appId: string;
  dataSource: DataSource;
  connectBaseUrl: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>(
    enabled ? "checking" : "authenticated",
  );
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const startedRef = useRef(false);
  const authenticatingRef = useRef(false);
  const recoveringRef = useRef(false);
  const recoveredAtRef = useRef(0);
  const retryAfterRef = useRef(0);

  const verifyCurrentSession = useCallback(async () => {
    const status = await fetch("/api/auth/session", { cache: "no-store" });
    const current = (await status.json()) as {
      authenticated?: boolean;
      user?: { id?: string } | null;
    };
    if (!status.ok || !current.authenticated || !current.user?.id) return false;
    await validateSessionUser(current.user.id, { dataSource, connectBaseUrl });
    return true;
  }, [connectBaseUrl, dataSource]);

  const authenticate = useCallback(
    async (clearSession = false) => {
      if (authenticatingRef.current) return false;
      if (retryAfterRef.current > 0) return false;
      authenticatingRef.current = true;
      setError("");
      setState("checking");

      try {
        if (clearSession) {
          const cleared = await fetch("/api/auth/session", {
            method: "DELETE",
          });
          if (!cleared.ok) throw new Error("旧登录会话清理失败，请重新登录");
        }
        if (!clearSession) {
          try {
            if (await verifyCurrentSession()) {
              setState("authenticated");
              return true;
            }
          } catch (reason) {
            if (!(reason instanceof AuthRequiredError)) throw reason;
          }
        }
        if (!appId)
          throw new Error("缺少飞书应用 ID，请联系管理员完成部署配置");

        setState("authenticating");
        const client = await waitForLarkLoginClient(window);
        const code = await requestLarkAuthorizationCode(client, appId);
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (response.status === 429) {
          const seconds = parseRetryAfter(response.headers.get("retry-after"));
          retryAfterRef.current = seconds;
          setRetryAfter(seconds);
          throw new Error(`登录请求过于频繁，请 ${seconds} 秒后重试`);
        }
        if (!response.ok) throw new Error("登录会话建立失败，请重新授权");

        setState("authenticated");
        router.refresh();
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "登录失败，请稍后重试",
        );
        setState("error");
        return false;
      } finally {
        authenticatingRef.current = false;
      }
    },
    [appId, router, verifyCurrentSession],
  );

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timeout = window.setTimeout(() => {
      const next = Math.max(0, retryAfterRef.current - 1);
      retryAfterRef.current = next;
      setRetryAfter(next);
      setError(next > 0 ? `登录请求过于频繁，请 ${next} 秒后重试` : "");
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [retryAfter]);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    void authenticate();
  }, [authenticate, enabled]);

  useEffect(() => {
    if (!enabled || state !== "authenticated") return;
    const verify = async () => {
      try {
        if (!(await verifyCurrentSession())) {
          window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
        }
      } catch (reason) {
        if (!(reason instanceof AuthRequiredError)) return;
        window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
      }
    };
    void verify();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void verify();
    };
    window.addEventListener("focus", verify);
    window.addEventListener(sessionProbeEventName, verify);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void verify();
    }, sessionProbeIntervalMs);
    return () => {
      window.removeEventListener("focus", verify);
      window.removeEventListener(sessionProbeEventName, verify);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [enabled, pathname, state, verifyCurrentSession]);

  useEffect(() => {
    if (!enabled) return;

    const handleSessionExpired = async () => {
      if (
        recoveringRef.current ||
        Date.now() - recoveredAtRef.current < staleRequestWindowMs
      )
        return;
      recoveringRef.current = true;
      try {
        if (await authenticate(true)) recoveredAtRef.current = Date.now();
      } finally {
        recoveringRef.current = false;
      }
    };
    window.addEventListener(
      AuthRequiredError.browserEventName,
      handleSessionExpired,
    );
    return () =>
      window.removeEventListener(
        AuthRequiredError.browserEventName,
        handleSessionExpired,
      );
  }, [authenticate, enabled]);

  if (state === "authenticated") {
    return (
      <>
        <Suspense fallback={null}>
          <SearchParamsSessionProbe />
        </Suspense>
        {children}
      </>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RiShieldUserLine />
          </span>
          <CardTitle>登录 SAST 商城</CardTitle>
          <CardDescription>
            {state === "error" ? error : "正在通过飞书安全登录，请稍候…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {state === "error" ? (
            <Button
              disabled={retryAfter > 0}
              onClick={() => void authenticate()}
            >
              {retryAfter > 0 ? `${retryAfter} 秒后重试` : "重新登录"}
            </Button>
          ) : (
            <Spinner className="text-primary" />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function SearchParamsSessionProbe() {
  const searchParams = useSearchParams().toString();
  useEffect(() => {
    window.dispatchEvent(new Event(sessionProbeEventName));
  }, [searchParams]);
  return null;
}

function parseRetryAfter(value: string | null): number {
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? Math.min(60, Math.max(1, Math.ceil(seconds)))
    : 1;
}
