import { Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { resolveConnectBaseUrl, type ServiceOptions } from "./data-source";
import {
  ApiRequestError,
  AuthRequiredError,
  ResourceNotFoundError,
} from "./errors";

export function createLocalTransport(options: ServiceOptions = {}) {
  return createConnectTransport({
    baseUrl: resolveConnectBaseUrl(options),
    defaultTimeoutMs: 15_000,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

export async function requestLocal<T>(
  feature: string,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const connectError = ConnectError.from(error);

    if (connectError.code === Code.Unauthenticated) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
      }
      throw new AuthRequiredError();
    }

    if (connectError.code === Code.NotFound) {
      throw new ResourceNotFoundError(feature);
    }

    throw new ApiRequestError(feature, error);
  }
}
