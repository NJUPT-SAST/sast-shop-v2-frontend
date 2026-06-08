import type { DataSource } from "@sast-shop/api"

const supportedDesktopDataSources = new Set<DataSource>([
  "mock",
  "local",
  "remote",
])
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE

function isDesktopDataSource(value: string | undefined): value is DataSource {
  return value !== undefined && supportedDesktopDataSources.has(value as DataSource)
}

export function resolveDesktopDataSource(value: string | undefined): DataSource {
  return isDesktopDataSource(value) ? value : "mock"
}

const isDataSourceFallback =
  dataSourceEnv !== undefined && !isDesktopDataSource(dataSourceEnv)

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
}
