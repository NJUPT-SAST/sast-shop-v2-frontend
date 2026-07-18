import { Code, ConnectError } from "@connectrpc/connect"
import { createConnectTransport } from "@connectrpc/connect-web"
import {
  resolveConnectBaseUrl,
  type ServiceOptions,
} from "./data-source"
import { ApiRequestError, ResourceNotFoundError } from "./errors"

export function createLocalTransport(options: ServiceOptions = {}) {
  return createConnectTransport({
    baseUrl: resolveConnectBaseUrl(options),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })
}

export async function requestLocal<T>(
  feature: string,
  request: () => Promise<T>
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (ConnectError.from(error).code === Code.NotFound) {
      throw new ResourceNotFoundError(feature)
    }

    throw new ApiRequestError(feature, error)
  }
}
