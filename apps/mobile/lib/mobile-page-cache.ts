import type { DataSource } from "@sast-shop/api";
import { getResourceSnapshot } from "@workspace/ui/lib/resource-cache";

export function hasCachedMobilePage(
  pathname: string,
  options: {
    dataSource: DataSource;
    connectBaseUrl: string;
    authRequired: boolean;
  },
): boolean {
  const { dataSource, connectBaseUrl, authRequired } = options;
  const scope = JSON.stringify([dataSource, connectBaseUrl]);
  const keys: Record<string, string[]> = {
    "/shop": [JSON.stringify(["mobile:shop", dataSource, connectBaseUrl])],
    "/group": [`group:stores:${scope}`, `group:tasks:${scope}`],
    "/orders": [
      "orders:spot:buyer",
      "orders:spot:seller",
      "orders:errand:participant",
      "orders:errand:captain",
    ].map(
      (key) =>
        `${key}:${JSON.stringify(["mobile", dataSource, connectBaseUrl])}`,
    ),
    "/profile": [
      `profile:user:${JSON.stringify([dataSource, connectBaseUrl, authRequired])}`,
    ],
    "/group/errand": [`mobile:errand-lobby:${dataSource}:${connectBaseUrl}`],
  };
  return (keys[pathname] ?? []).some(
    (key) => getResourceSnapshot(key).data !== undefined,
  );
}
