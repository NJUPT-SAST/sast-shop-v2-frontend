import type { DataSource } from "@sast-shop/api"
import { parseAuthMode, resolveAuthModeFallback } from "./auth-mode"

const supportedMobileDataSources = new Set<DataSource>([
  "mock",
  "local",
  "remote",
])
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE
const connectBaseUrlEnv = process.env.NEXT_PUBLIC_CONNECT_BASE_URL
const authModeEnv = process.env.NEXT_PUBLIC_AUTH_MODE
const appOriginEnv = process.env.NEXT_PUBLIC_APP_ORIGIN

function isMobileDataSource(value: string | undefined): value is DataSource {
  return (
    value !== undefined && supportedMobileDataSources.has(value as DataSource)
  )
}

export function resolveMobileDataSource(value: string | undefined): DataSource {
  return isMobileDataSource(value) ? value : "local"
}

const isDataSourceFallback =
  dataSourceEnv !== undefined && !isMobileDataSource(dataSourceEnv)
const authMode = parseAuthMode(authModeEnv)
const appOrigin = appOriginEnv ?? "https://m.sast-shop.example.com"
const appBaseUrl = appOrigin.replace(/\/$/, "")

export const mobileAppConfig = {
  appName: "SAST 商城",
  dataSource: resolveMobileDataSource(dataSourceEnv),
  dataSourceFallback: isDataSourceFallback
    ? {
        providedValue: dataSourceEnv,
        fallbackValue: "local" satisfies DataSource,
      }
    : null,
  appOrigin,
  connectBaseUrl:
    authMode === "required"
      ? `${appBaseUrl}/api/connect`
      : (connectBaseUrlEnv ?? "http://127.0.0.1:6660"),
  authMode,
  authModeFallback: resolveAuthModeFallback(authModeEnv),
}
