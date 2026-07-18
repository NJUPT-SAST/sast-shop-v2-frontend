import type { LarkClientApi, LarkH5Sdk } from "@sast-shop/api";

declare global {
  interface Window {
    h5sdk?: LarkH5Sdk;
    tt?: LarkClientApi;
  }
}

export {};
