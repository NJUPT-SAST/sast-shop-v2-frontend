import type { DataSource } from "@sast-shop/api"

const profileDataSourceLabels: Record<DataSource, string> = {
  mock: "模拟数据",
  local: "本地数据",
  remote: "远程数据",
}

export function formatProfileDataSource(dataSource: DataSource): string {
  return profileDataSourceLabels[dataSource]
}

export function formatProfileOverviewError(): string {
  return "资料管理暂不可用，请稍后再试"
}
