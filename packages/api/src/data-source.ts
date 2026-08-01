import { ApiConfigurationError } from "./errors";

export type DataSource = "mock" | "local" | "remote";

export interface CurrentUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface ServiceOptions {
  dataSource?: DataSource;
  connectBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  currentUser?: CurrentUser;
  requiresAuthenticatedUser?: boolean;
}

export function resolveDataSource(options: ServiceOptions = {}): DataSource {
  return options.dataSource ?? "mock";
}

export function resolveConnectBaseUrl(options: ServiceOptions = {}): string {
  const baseUrl =
    options.connectBaseUrl ?? process.env.NEXT_PUBLIC_CONNECT_BASE_URL;

  if (!baseUrl) {
    throw new ApiConfigurationError("NEXT_PUBLIC_CONNECT_BASE_URL");
  }

  return baseUrl;
}
