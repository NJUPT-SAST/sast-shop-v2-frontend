"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFeishuLoginReturnTo } from "../../../config/feishu-redirect-uri";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      getFeishuLoginReturnTo(
        new URLSearchParams(window.location.search).get("returnTo"),
      ),
    );
  }, [router]);
  return null;
}
