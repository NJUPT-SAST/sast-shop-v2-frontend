"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RiShieldCheckLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";

export function AdminEntry() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    const check = () => {
      void fetch("/api/admin/session", { cache: "no-store" })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((result) => {
          if (active)
            setAllowed(
              Boolean(
                result?.identity &&
                ["admin", "superadmin"].includes(result.identity.role),
              ),
            );
        })
        .catch(() => {
          if (active) setAllowed(false);
        });
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  }, []);
  return allowed ? (
    <Button
      variant="ghost"
      asChild
      className="min-h-11 w-full justify-center px-2 lg:justify-start lg:px-3"
    >
      <Link href="/admin" title="管理后台">
        <RiShieldCheckLine className="size-5" />
        <span className="hidden lg:inline">管理后台</span>
      </Link>
    </Button>
  ) : null;
}
