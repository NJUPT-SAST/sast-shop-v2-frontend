import type { DataSource } from "@sast-shop/api";

const supportedDesktopDataSources = new Set<DataSource>([
  "mock",
  "local",
  "remote",
]);
const dataSourceEnv = process.env.NEXT_PUBLIC_DATA_SOURCE;
const appOrigin = (
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3002"
).replace(/\/$/, "");

function isDesktopDataSource(value: string | undefined): value is DataSource {
  return (
    value !== undefined && supportedDesktopDataSources.has(value as DataSource)
  );
}

export function resolveDesktopDataSource(
  value: string | undefined,
): DataSource {
  if (value === undefined) return "mock";
  if (isDesktopDataSource(value)) return value;
  throw new Error(
    `NEXT_PUBLIC_DATA_SOURCE 必须是 mock、local 或 remote，当前值为 ${JSON.stringify(value)}`,
  );
}

export const desktopAppConfig = {
  appName: "SAST 商城 PC 端",
  dataSource: resolveDesktopDataSource(dataSourceEnv),
  appOrigin,
  connectBaseUrl: `${appOrigin}/api/connect`,
};
