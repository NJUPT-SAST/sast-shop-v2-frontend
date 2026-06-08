import type { DataSource } from "@sast-shop/api"

export const mobileAppConfig = {
  appName: "SAST 商城",
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") as DataSource,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://m.sast-shop.example.com",
}
