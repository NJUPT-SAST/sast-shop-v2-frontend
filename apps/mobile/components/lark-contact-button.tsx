"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { RiMessage3Line } from "@remixicon/react";
import {
  withLarkPageJsapi,
  enterLarkChat,
  getBuyerErrandOrderCaptainContact,
  getSpotOrderSellerContact,
  isLarkClientEnvironment,
  subscribeLarkEnvironment,
  type DataSource,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { isJsapiAuthConfig } from "@/lib/jsapi-config";

export function LarkContactButton({
  target,
  orderId,
  dataSource,
  connectBaseUrl,
  label,
  iconOnly = false,
  className,
}: {
  target: "spot-seller" | "errand-captain";
  orderId: string;
  dataSource: DataSource;
  connectBaseUrl: string;
  label: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const available = useLarkContactAvailability();
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

    const client = window.tt;
    try {
      const contactOpenId = await loadContactOpenId({
        target,
        orderId,
        dataSource,
        connectBaseUrl,
      });
      await withLarkPageJsapi(
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
        () => enterLarkChat(client, contactOpenId),
        ["tt.enterChat"],
      );
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
      size={iconOnly ? "icon-touch" : "default"}
      className={cn("min-w-0", className)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      disabled={pending}
      onClick={() => void openChat()}
    >
      {pending ? <Spinner /> : <RiMessage3Line data-icon="inline-start" />}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}

export function useLarkContactAvailability(): boolean {
  const feishuUiEnvironment = useFeishuUiEnvironment();
  const jsapiAvailable = useSyncExternalStore(
    subscribeLarkEnvironment,
    () => isLarkClientEnvironment(window.h5sdk),
    () => false,
  );

  return feishuUiEnvironment || jsapiAvailable;
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
  connectBaseUrl: string;
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
