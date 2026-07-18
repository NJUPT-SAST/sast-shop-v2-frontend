import {
  listErrandDemandStores,
  type ErrandDemandStoreSummary,
} from "@sast-shop/api";

import { ErrandDemandHall } from "@/components/errand-demand-hall";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ErrandDemandHallPage() {
  let demands: ErrandDemandStoreSummary[] = [];
  let error: string | null = null;

  try {
    demands = await listErrandDemandStores(await getServerServiceOptions());
  } catch {
    error = "跑腿需求暂不可用，请稍后再试。";
  }

  return <ErrandDemandHall demands={demands} error={error} />;
}
