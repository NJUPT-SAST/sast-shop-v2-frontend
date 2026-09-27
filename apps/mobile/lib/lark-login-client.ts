import type { LarkClientApi, LarkH5Sdk } from "@sast-shop/api";

type LarkLoginEnvironment = {
  h5sdk?: LarkH5Sdk;
  tt?: LarkClientApi;
};

// Script execution and the native bridge may finish at different times.
// Only the real SDK ready callback and a real login API can unlock login.
export function waitForLarkLoginClient(
  environment: LarkLoginEnvironment,
  timeoutMs = 15_000,
): Promise<LarkClientApi> {
  return new Promise((resolve, reject) => {
    let activeSdk: LarkH5Sdk | undefined;
    let readySdk: LarkH5Sdk | undefined;
    let settled = false;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      const message = !environment.h5sdk?.ready
        ? "飞书登录组件加载失败，请检查网络后重新打开应用"
        : !readySdk
          ? "飞书客户端初始化超时，请重新打开应用或升级飞书后重试"
          : "飞书登录接口未就绪，请从飞书工作台重新打开应用或升级飞书后重试";
      fail(new Error(message));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      clearTimeout(poll);
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function check() {
      if (settled) return;
      const sdk = environment.h5sdk;
      if (sdk && typeof sdk.ready === "function" && activeSdk !== sdk) {
        activeSdk = sdk;
        readySdk = undefined;
        const versions = sdk.browser?.versions;
        if (versions?.mobileFeishu === false && versions.PCFeishu === false) {
          fail(new Error("请在飞书客户端内打开该应用"));
          return;
        }
        try {
          sdk.ready(() => {
            if (!settled && environment.h5sdk === sdk) readySdk = sdk;
          });
        } catch {
          fail(new Error("飞书客户端初始化失败，请重新打开应用后重试"));
          return;
        }
      }

      const client = environment.tt;
      if (
        sdk &&
        readySdk === sdk &&
        client &&
        (typeof client.requestAccess === "function" ||
          typeof client.requestAuthCode === "function")
      ) {
        settled = true;
        cleanup();
        resolve(client);
        return;
      }
      poll = setTimeout(check, 50);
    }

    check();
  });
}
