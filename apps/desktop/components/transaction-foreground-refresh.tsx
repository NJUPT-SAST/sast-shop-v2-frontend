"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function TransactionForegroundRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!/^\/(orders|group)(\/|$)/.test(pathname)) return;
    let lastRefresh = 0;
    const refresh = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastRefresh < 1000
      )
        return;
      lastRefresh = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, router]);
  return null;
}
