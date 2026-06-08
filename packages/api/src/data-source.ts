export type DataSource = "mock" | "local" | "remote"

export interface ServiceOptions {
  dataSource?: DataSource
}

export function resolveDataSource(options: ServiceOptions = {}): DataSource {
  return options.dataSource ?? "mock"
}
