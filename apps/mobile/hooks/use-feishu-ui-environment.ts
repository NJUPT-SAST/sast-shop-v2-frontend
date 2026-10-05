"use client";

import { useSyncExternalStore } from "react";
import {
  isLarkMobileClientEnvironment,
  subscribeLarkEnvironment,
} from "@sast-shop/api";

const forceFeishuUi = process.env.NEXT_PUBLIC_FORCE_FEISHU_UI === "true";

export function useFeishuUiEnvironment(): boolean {
  return useSyncExternalStore(
    subscribeLarkEnvironment,
    () => forceFeishuUi || isLarkMobileClientEnvironment(window.h5sdk),
    () => forceFeishuUi,
  );
}
