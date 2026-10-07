"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useMobileNavigation } from "./mobile-navigation-feedback";

export default function MobileLink({
  onNavigate,
  href,
  replace,
  scroll,
  transitionTypes,
  ...props
}: ComponentProps<typeof NextLink>) {
  const navigation = useMobileNavigation();

  return (
    <NextLink
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      transitionTypes={transitionTypes}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented || !navigation || typeof href !== "string") return;
        event.preventDefault();
        const options = { scroll, transitionTypes };
        if (replace) {
          navigation.router.replace(href, options);
        } else {
          navigation.router.push(href, options);
        }
      }}
    />
  );
}
