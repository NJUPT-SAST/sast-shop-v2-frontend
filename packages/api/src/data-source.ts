import { ApiConfigurationError } from "./errors"

export type DataSource = "mock" | "local" | "remote"

export interface ServiceOptions {
  dataSource?: DataSource
  connectBaseUrl?: string
}

export function resolveDataSource(options: ServiceOptions = {}): DataSource {
  return options.dataSource ?? "mock"
}

export function resolveConnectBaseUrl(options: ServiceOptions = {}): string {
  const baseUrl = options.connectBaseUrl ?? process.env.NEXT_PUBLIC_CONNECT_BASE_URL

  if (!baseUrl) {
    throw new ApiConfigurationError("NEXT_PUBLIC_CONNECT_BASE_URL")
  }

  return baseUrl
}
