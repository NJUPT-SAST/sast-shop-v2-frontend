import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import type { ConnectTransportOptions } from "@connectrpc/connect-web";

const { createConnectTransport } = vi.hoisted(() => ({
  createConnectTransport: vi.fn<
    (options: ConnectTransportOptions) => { kind: string }
  >(() => ({ kind: "transport" })),
}));

vi.mock("@connectrpc/connect-web", () => ({ createConnectTransport }));

import {
  Code,
  ConnectError,
  createContextValues,
  type Interceptor,
  type UnaryRequest,
} from "@connectrpc/connect";

import { AuthRequiredError, ResourceNotFoundError } from "./errors";
import {
  GetUserInfoRequestSchema,
  UserService,
} from "./gen/sast/sastshopv2/user/v1/user_service_pb";
import { createLocalTransport, requestLocal } from "./local-connect";

const initialDevUserId = process.env.NEXT_PUBLIC_DEV_USER_ID;

function createRequest(header: HeadersInit = {}): UnaryRequest {
  return {
    stream: false,
    service: UserService,
    method: UserService.method.getUserInfo,
    requestMethod: "POST",
    url: "https://backend.example.test/sast.sastshopv2.user.v1.UserService/GetUserInfo",
    signal: new AbortController().signal,
    header: new Headers(header),
    contextValues: createContextValues(),
    message: create(GetUserInfoRequestSchema, { userId: 10001n }),
  };
}

function getConfiguredInterceptor(): Interceptor {
  const interceptor =
    createConnectTransport.mock.calls[0]?.[0]?.interceptors?.[0];
  expect(interceptor).toBeTypeOf("function");
  if (!interceptor) throw new Error("Connect interceptor was not configured");
  return interceptor;
}

async function forwardRequest(interceptor: Interceptor, request: UnaryRequest) {
  const next = vi.fn(async () => {
    throw new Error("request forwarded");
  });
  await expect(interceptor(next)(request)).rejects.toThrow("request forwarded");
  expect(next).toHaveBeenCalledWith(request);
}

describe("local Connect transport", () => {
  beforeEach(() => {
    createConnectTransport.mockClear();
    delete process.env.NEXT_PUBLIC_DEV_USER_ID;
  });

  afterEach(() => {
    if (initialDevUserId === undefined) {
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    } else {
      process.env.NEXT_PUBLIC_DEV_USER_ID = initialDevUserId;
    }
    vi.unstubAllGlobals();
  });

  it("applies a bounded default timeout", () => {
    const customFetch = vi.fn<typeof fetch>();

    createLocalTransport({
      connectBaseUrl: "https://backend.example.test",
      fetch: customFetch,
    });

    const interceptor = getConfiguredInterceptor();
    expect(createConnectTransport).toHaveBeenCalledWith({
      baseUrl: "https://backend.example.test",
      defaultTimeoutMs: 15_000,
      fetch: customFetch,
      interceptors: [interceptor],
    });
  });

  it("adds the configured development user header", async () => {
    process.env.NEXT_PUBLIC_DEV_USER_ID = "10001";
    createLocalTransport({ connectBaseUrl: "https://backend.example.test" });
    const request = createRequest();

    await forwardRequest(getConfiguredInterceptor(), request);

    expect(request.header.get("x-dev-user-id")).toBe("10001");
  });

  it("does not overwrite an existing development user header", async () => {
    process.env.NEXT_PUBLIC_DEV_USER_ID = "10001";
    createLocalTransport({ connectBaseUrl: "https://backend.example.test" });
    const request = createRequest({ "x-dev-user-id": "20002" });

    await forwardRequest(getConfiguredInterceptor(), request);

    expect(request.header.get("x-dev-user-id")).toBe("20002");
  });

  it("does not inject a development user header without configuration", async () => {
    createLocalTransport({ connectBaseUrl: "https://backend.example.test" });
    const request = createRequest();

    await forwardRequest(getConfiguredInterceptor(), request);

    expect(request.header.has("x-dev-user-id")).toBe(false);
  });

  it("turns unauthenticated responses into an auth recovery signal", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    await expect(
      requestLocal("getCurrentUser", () =>
        Promise.reject(new ConnectError("expired", Code.Unauthenticated)),
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: AuthRequiredError.browserEventName }),
    );
  });

  it("keeps not-found responses distinct from authentication failures", async () => {
    await expect(
      requestLocal("getStore", () =>
        Promise.reject(new ConnectError("missing", Code.NotFound)),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
