"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  RiAddLine,
  RiFileList3Line,
  RiGroupLine,
  RiQrScan2Line,
  RiUser3Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { SastShopMark } from "@workspace/ui/components/sast-shop-mark";
import { Input } from "@workspace/ui/components/input";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/utils";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { useMobileScroll } from "./mobile-scroll-context";
import { normalizeBarcodeQuery } from "@/lib/product-template-flow";

const navItems = [
  { label: "商城", href: "/shop", icon: SastShopMark },
  { label: "团购", href: "/group", icon: RiGroupLine },
  { label: "订单", href: "/orders", icon: RiFileList3Line },
  { label: "我的", href: "/profile", icon: RiUser3Line },
] as const;

const NAV_CLICK_DEBOUNCE_MS = 350;

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const lastCurrentRoutePressAtRef = useRef(0);
  const showFeishuEntry = useFeishuUiEnvironment();
  const { handleCurrentRoutePress, scrollToTop } = useMobileScroll();
  const [publishOpen, setPublishOpen] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  function handleBarcodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeBarcodeQuery(barcode);
    if (!result.ok) {
      setBarcodeError(result.message);
      barcodeRef.current?.focus();
      return;
    }
    setPublishOpen(false);
    router.push(
      `/publish/spot?entry=manual&barcode=${encodeURIComponent(result.barcode)}`,
    );
  }

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    isActive: boolean,
  ) {
    if (isActive) {
      const now = Date.now();
      event.preventDefault();

      if (now - lastCurrentRoutePressAtRef.current < NAV_CLICK_DEBOUNCE_MS) {
        return;
      }

      lastCurrentRoutePressAtRef.current = now;
      handleCurrentRoutePress();
      return;
    }

    scrollToTop();
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-around px-2">
        {navItems.slice(0, 2).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavClick={handleNavClick}
          />
        ))}

        <Drawer
          open={publishOpen}
          onOpenChange={(open) => {
            setPublishOpen(open);
            if (open) {
              setBarcode("");
              setBarcodeError(null);
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button
              type="button"
              className="h-12 min-w-14 flex-col gap-0.5 rounded-xl px-3"
              aria-label="上架现货"
            >
              <RiAddLine aria-hidden="true" />
              <span className="text-xs">上架</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="overflow-clip">
            <DrawerHeader>
              <DrawerTitle>上架现货</DrawerTitle>
              <DrawerDescription className="sr-only">
                输入或扫描商品条码，再填写价格和库存。
              </DrawerDescription>
            </DrawerHeader>
            <form
              onSubmit={handleBarcodeSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4">
                <Field data-invalid={Boolean(barcodeError)}>
                  <FieldLabel htmlFor="publish-entry-barcode">
                    商品条码
                  </FieldLabel>
                  <Input
                    ref={barcodeRef}
                    id="publish-entry-barcode"
                    value={barcode}
                    className="h-11"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={64}
                    placeholder="输入商品包装上的条码"
                    aria-invalid={Boolean(barcodeError)}
                    aria-describedby={
                      barcodeError ? "publish-entry-error" : undefined
                    }
                    onChange={(event) => {
                      setBarcode(event.target.value);
                      setBarcodeError(null);
                    }}
                  />
                  {barcodeError ? (
                    <FieldError id="publish-entry-error">
                      {barcodeError}
                    </FieldError>
                  ) : null}
                </Field>
              </div>
              <DrawerFooter className="shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="submit" className="min-h-11">
                  继续填写商品信息
                </Button>
                {showFeishuEntry ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setPublishOpen(false);
                      router.push("/publish/spot?entry=scan");
                    }}
                  >
                    <RiQrScan2Line />
                    扫码录入
                  </Button>
                ) : null}
              </DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>

        {navItems.slice(2).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavClick={handleNavClick}
          />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavClick,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  onNavClick: (event: MouseEvent<HTMLAnchorElement>, isActive: boolean) => void;
}) {
  const isActive = pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => onNavClick(event, isActive)}
      className={cn(
        "flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span>{item.label}</span>
    </Link>
  );
}
