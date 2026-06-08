import type { DataSource } from "@sast-shop/api"

const supportedMobileDataSources = new Set<DataSource>(["mock", "local", "remote"])
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE

function isMobileDataSource(value: string | undefined): value is DataSource {
  return value !== undefined && supportedMobileDataSources.has(value as DataSource)
}

export function resolveMobileDataSource(value: string | undefined): DataSource {
  return isMobileDataSource(value) ? value : "mock"
}

const isDataSourceFallback =
  dataSourceEnv !== undefined && !isMobileDataSource(dataSourceEnv)

export const mobileAppConfig = {
  appName: "SAST 商城",
  dataSource: resolveMobileDataSource(dataSourceEnv),
  dataSourceFallback: isDataSourceFallback
    ? {
        providedValue: dataSourceEnv,
        fallbackValue: "mock" satisfies DataSource,
      }
    : null,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://m.sast-shop.example.com",
}
