"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import {
  RiAddLine,
  RiFileList3Line,
  RiGroupLine,
  RiKeyboardBoxLine,
  RiQrScan2Line,
  RiUser3Line,
  RiCameraLine,
  RiStore2Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { SastShopMark } from "@workspace/ui/components/sast-shop-mark";
import { cn } from "@workspace/ui/lib/utils";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { useMobileScroll } from "./mobile-scroll-context";

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
  const [publishStep, setPublishStep] = useState<"choose" | "spot">("choose");
  const { handleCurrentRoutePress, scrollToTop } = useMobileScroll();

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
          onOpenChange={(open) => {
            if (open) setPublishStep("choose");
          }}
        >
          <DrawerTrigger asChild>
            <PublishTriggerButton />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {publishStep === "choose" ? "选择功能" : "上架现货"}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {publishStep === "choose"
                  ? "上架商品，或用合照发起聚餐 AA"
                  : "选择商品条码录入方式"}
              </DrawerDescription>
            </DrawerHeader>
            <div className="grid grid-cols-2 gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {publishStep === "choose" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex-col gap-2 rounded-xl"
                    onClick={() => {
                      if (showFeishuEntry) setPublishStep("spot");
                      else router.push("/publish/spot?entry=manual");
                    }}
                  >
                    <RiStore2Line />
                    上架现货
                  </Button>
                  <DrawerClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-24 flex-col gap-2 rounded-xl text-primary"
                      onClick={() => router.push("/west-pocket/new")}
                    >
                      <RiCameraLine />
                      West Pocket
                    </Button>
                  </DrawerClose>
                </>
              ) : (
                <>
                  <DrawerClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-24 flex-col gap-2 rounded-xl bg-card shadow-sm"
                      onClick={() => router.push("/publish/spot?entry=manual")}
                    >
                      <RiKeyboardBoxLine />
                      手动输入
                    </Button>
                  </DrawerClose>
                  <DrawerClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      className="h-24 flex-col gap-2 rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm hover:bg-primary/15"
                      onClick={() => router.push("/publish/spot?entry=scan")}
                    >
                      <RiQrScan2Line />
                      扫码录入
                    </Button>
                  </DrawerClose>
                </>
              )}
            </div>
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

function PublishTriggerButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      type="button"
      size="icon-touch"
      className="-mt-8 size-14 rounded-full shadow-xl shadow-foreground/15 ring-1 ring-border/60"
      aria-label="选择发布功能"
      onClick={onClick}
    >
      <RiAddLine className="size-6" />
    </Button>
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
