"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RiAddLine } from "@remixicon/react";
import { toast } from "sonner";
import {
  configureLarkPageJsapi,
  isLarkScanCancelledError,
  scanLarkBarcode,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { isJsapiAuthConfig } from "@/lib/jsapi-config";
import { BrandIllustration } from "./brand-illustration";

export function MobilePublishEntry() {
  const router = useRouter();
  const pathname = usePathname();
  const showFeishuEntry = useFeishuUiEnvironment();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const pendingScanRef = useRef<symbol | null>(null);
  const pendingNavigationRef = useRef<symbol | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      pendingScanRef.current = null;
      pendingNavigationRef.current = null;
    },
    [pathname],
  );

  async function handleScan() {
    if (pendingScanRef.current || pendingNavigationRef.current) return;
    const sdk = window.h5sdk;
    const client = window.tt;
    if (!sdk || !client?.scanCode) {
      toast.message("飞书扫码组件尚未就绪，请稍后重试");
      return;
    }
    const request = Symbol();
    pendingScanRef.current = request;
    setScanning(true);
    try {
      await configureLarkPageJsapi(sdk, async (signingUrl) => {
        const response = await fetch(
          `/api/auth/jsapi-config?url=${encodeURIComponent(signingUrl)}`,
          { cache: "no-store" },
        );
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isJsapiAuthConfig(body)) {
          throw new Error(
            response.status === 401
              ? "登录已失效，请重新打开应用"
              : "扫码鉴权暂不可用，请稍后再试",
          );
        }
        return body;
      });
      if (pendingScanRef.current !== request) return;
      const scannedBarcode = await scanLarkBarcode(client);
      if (pendingScanRef.current !== request) return;
      setOpen(false);
      await waitForDrawerHistoryCleanup();
      if (pendingScanRef.current !== request) return;
      router.push(
        `/publish/spot?entry=scan&barcode=${encodeURIComponent(scannedBarcode)}`,
      );
    } catch (reason) {
      if (
        pendingScanRef.current !== request ||
        isLarkScanCancelledError(reason)
      )
        return;
      const message =
        reason instanceof Error ? reason.message : "扫码失败，请重试";
      toast.error(
        message === "扫描结果不是有效商品条码，请手动输入"
          ? "未识别到商品条码，请重新扫码"
          : message,
      );
    } finally {
      if (pendingScanRef.current === request) {
        pendingScanRef.current = null;
        setScanning(false);
      }
    }
  }

  async function openPocket() {
    if (pendingScanRef.current || pendingNavigationRef.current) return;
    const request = Symbol();
    pendingNavigationRef.current = request;
    setOpen(false);
    await waitForDrawerHistoryCleanup();
    if (pendingNavigationRef.current !== request) return;
    pendingNavigationRef.current = null;
    router.push("/pocket/new");
  }

  return (
    <Drawer
      open={open}
      autoFocus
      onOpenChange={(nextOpen) => {
        pendingScanRef.current = null;
        pendingNavigationRef.current = null;
        setScanning(false);
        setOpen(nextOpen);
      }}
    >
      <DrawerTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          size="icon-touch"
          className="-mt-8 size-14 rounded-full shadow-xl shadow-foreground/15 ring-1 ring-border/60"
          aria-label="发布"
        >
          <RiAddLine className="size-6" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="overflow-clip"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!open) triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <DrawerHeader>
          <DrawerTitle>发布</DrawerTitle>
          <DrawerDescription className="sr-only">
            选择上架现货或发起 Pocket
          </DrawerDescription>
        </DrawerHeader>
        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div
            className={`grid gap-3 ${showFeishuEntry ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {showFeishuEntry ? (
              <Button
                type="button"
                variant="outline"
                aria-label="上架现货"
                aria-describedby="publish-scan-description"
                className="h-auto min-h-36 flex-col gap-2 rounded-xl bg-card px-3 py-4 shadow-sm"
                disabled={scanning}
                onClick={() => void handleScan()}
              >
                <BrandIllustration name="scan" size={48} />
                <span className="min-w-0 text-center">
                  <span className="block font-semibold">
                    {scanning ? "正在扫码" : "上架现货"}
                  </span>
                  <span
                    id="publish-scan-description"
                    className="mt-1 block text-xs font-normal text-muted-foreground"
                  >
                    扫描商品条码
                  </span>
                </span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              aria-label="发起 Pocket"
              aria-describedby="publish-pocket-description"
              className="h-auto min-h-36 flex-col gap-2 rounded-xl bg-card px-3 py-4 shadow-sm"
              disabled={scanning}
              onClick={() => void openPocket()}
            >
              <BrandIllustration name="pocket" size={48} />
              <span className="min-w-0 text-center">
                <span className="block font-semibold">发起 Pocket</span>
                <span
                  id="publish-pocket-description"
                  className="mt-1 block text-xs font-normal text-muted-foreground"
                >
                  选人分摊与收款
                </span>
              </span>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
