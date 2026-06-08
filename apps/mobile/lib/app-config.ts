import type { DataSource } from "@sast-shop/api"

const supportedMobileDataSources = new Set<DataSource>(["mock", "local", "remote"])
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE
const connectBaseUrlEnv = process.env.NEXT_PUBLIC_CONNECT_BASE_URL

function isMobileDataSource(value: string | undefined): value is DataSource {
  return value !== undefined && supportedMobileDataSources.has(value as DataSource)
}

export function resolveMobileDataSource(value: string | undefined): DataSource {
  return isMobileDataSource(value) ? value : "local"
}

const isDataSourceFallback =
  dataSourceEnv !== undefined && !isMobileDataSource(dataSourceEnv)

export const mobileAppConfig = {
  appName: "SAST 商城",
  dataSource: resolveMobileDataSource(dataSourceEnv),
  dataSourceFallback: isDataSourceFallback
    ? {
        providedValue: dataSourceEnv,
        fallbackValue: "local" satisfies DataSource,
      }
    : null,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://m.sast-shop.example.com",
  connectBaseUrl: connectBaseUrlEnv ?? "http://127.0.0.1:6660",
}
