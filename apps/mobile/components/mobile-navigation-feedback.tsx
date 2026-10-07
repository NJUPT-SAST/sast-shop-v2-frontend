"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface MobileNavigationContextValue {
  router: ReturnType<typeof useRouter>;
  pendingPath: string | null;
}

const NavigationContext = createContext<MobileNavigationContextValue | null>(
  null,
);

export function MobileNavigationProvider({
  children,
  hasCachedPage,
}: {
  children: ReactNode;
  hasCachedPage?: (pathname: string) => boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const navigate = useCallback(
    (href: string, action: () => void) => {
      const target = new URL(href, window.location.href);
      if (target.origin === window.location.origin) {
        setTargetPath(target.pathname);
        setShowSkeleton(!hasCachedPage?.(target.pathname));
      }
      startTransition(action);
    },
    [hasCachedPage],
  );
  const navigation = useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) =>
        navigate(args[0], () => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) =>
        navigate(args[0], () => router.replace(...args)),
      back: () => {
        if (pending && targetPath !== pathname) {
          const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          navigate(current, () => router.replace(current));
          return;
        }
        router.back();
      },
    }),
    [navigate, router, pending, pathname, targetPath],
  );
  const pendingPath =
    pending && showSkeleton && targetPath !== pathname ? targetPath : null;

  return (
    <NavigationContext.Provider value={{ router: navigation, pendingPath }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useMobileRouter() {
  const router = useRouter();
  return useContext(NavigationContext)?.router ?? router;
}

export function useMobileNavigation() {
  return useContext(NavigationContext);
}

export function useMobilePathname() {
  const pathname = usePathname();
  return useContext(NavigationContext)?.pendingPath ?? pathname;
}
