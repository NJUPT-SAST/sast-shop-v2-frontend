"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { RiMessage3Line } from "@remixicon/react";
import {
  configureLarkPageJsapi,
  enterLarkChat,
  getBuyerErrandOrderCaptainContact,
  getSpotOrderSellerContact,
  isLarkClientEnvironment,
  subscribeLarkEnvironment,
  type DataSource,
  type JSAPIAuthConfig,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

export function LarkContactButton({
  target,
  orderId,
  dataSource,
  connectBaseUrl,
  label,
  className,
}: {
  target: "spot-seller" | "errand-captain";
  orderId: string;
  dataSource: DataSource;
  connectBaseUrl?: string;
  label: string;
  className?: string;
}) {
  const available = useSyncExternalStore(
    subscribeLarkEnvironment,
    () => isLarkClientEnvironment(window.h5sdk),
    () => false,
  );
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  if (!available) return null;

  async function openChat() {
    if (pendingRef.current) return;
    if (!window.h5sdk || !window.tt) {
      toast.error("飞书联系组件尚未就绪，请稍后重试");
      return;
    }
    pendingRef.current = true;
    setPending(true);

    try {
      const contactOpenId = await loadContactOpenId({
        target,
        orderId,
        dataSource,
        connectBaseUrl,
      });
      await configureLarkPageJsapi(
        window.h5sdk,
        async (signingUrl) => {
          const response = await fetch(
            `/api/auth/jsapi-config?url=${encodeURIComponent(signingUrl)}`,
            { cache: "no-store" },
          );
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok || !isJsapiAuthConfig(body)) {
            throw new Error(
              response.status === 401
                ? "登录已失效，请重新打开应用"
                : "联系功能暂不可用，请稍后再试",
            );
          }
          return body;
        },
        ["tt.enterChat"],
      );
      await enterLarkChat(window.tt, contactOpenId);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "打开飞书会话失败，请稍后重试",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("min-w-0", className)}
      disabled={pending}
      onClick={() => void openChat()}
    >
      {pending ? <Spinner /> : <RiMessage3Line data-icon="inline-start" />}
      {label}
    </Button>
  );
}

async function loadContactOpenId({
  target,
  orderId,
  dataSource,
  connectBaseUrl,
}: {
  target: "spot-seller" | "errand-captain";
  orderId: string;
  dataSource: DataSource;
  connectBaseUrl?: string;
}): Promise<string> {
  try {
    const openId =
      target === "spot-seller"
        ? await getSpotOrderSellerContact(orderId, {
            dataSource,
            connectBaseUrl,
          })
        : await getBuyerErrandOrderCaptainContact(orderId, {
            dataSource,
            connectBaseUrl,
          });
    if (!openId.trim()) throw new Error("empty contact");
    return openId.trim();
  } catch {
    throw new Error("联系人信息暂不可用，请稍后再试");
  }
}

function isJsapiAuthConfig(value: unknown): value is JSAPIAuthConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return ["appId", "timestamp", "nonceStr", "signature"].every(
    (key) => typeof config[key] === "string" && config[key].length > 0,
  );
}
