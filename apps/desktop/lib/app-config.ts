import type { DataSource } from "@sast-shop/api"

const supportedDesktopDataSources = new Set<DataSource>([
  "mock",
  "local",
  "remote",
])
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE
const connectBaseUrlEnv = process.env.NEXT_PUBLIC_CONNECT_BASE_URL
const authModeEnv = process.env.NEXT_PUBLIC_AUTH_MODE

type AuthMode = "off" | "required"

const supportedAuthModes = new Set<AuthMode>(["off", "required"])

function isDesktopDataSource(value: string | undefined): value is DataSource {
  return (
    value !== undefined && supportedDesktopDataSources.has(value as DataSource)
  )
}

function isAuthMode(value: string | undefined): value is AuthMode {
  return value !== undefined && supportedAuthModes.has(value as AuthMode)
}

export function resolveDesktopDataSource(
  value: string | undefined,
): DataSource {
  return isDesktopDataSource(value) ? value : "mock"
}

export function resolveDesktopAuthMode(value: string | undefined): AuthMode {
  return isAuthMode(value) ? value : "off"
}

const isDataSourceFallback =
  dataSourceEnv !== undefined && !isDesktopDataSource(dataSourceEnv)
const isAuthModeFallback = authModeEnv !== undefined && !isAuthMode(authModeEnv)

export const desktopAppConfig = {
  appName: "SAST 商城 PC 端",
  dataSource: resolveDesktopDataSource(dataSourceEnv),
  dataSourceFallback: isDataSourceFallback
    ? {
        providedValue: dataSourceEnv,
        fallbackValue: "mock" satisfies DataSource,
      }
    : null,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://shop.sast-shop.example.com",
  connectBaseUrl: connectBaseUrlEnv,
  authMode: resolveDesktopAuthMode(authModeEnv),
  authModeFallback: isAuthModeFallback
    ? {
        providedValue: authModeEnv,
        fallbackValue: "off" satisfies AuthMode,
      }
    : null,
}
