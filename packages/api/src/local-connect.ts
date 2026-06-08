import { createConnectTransport } from "@connectrpc/connect-web"
import {
  resolveConnectBaseUrl,
  type ServiceOptions,
} from "./data-source"
import { ApiRequestError } from "./errors"

export function createLocalTransport(options: ServiceOptions = {}) {
  return createConnectTransport({ baseUrl: resolveConnectBaseUrl(options) })
}

export async function requestLocal<T>(
  feature: string,
  request: () => Promise<T>
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    throw new ApiRequestError(feature, error)
  }
}
