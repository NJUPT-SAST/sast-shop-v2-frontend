import { cache } from "react";
import { getProfileOverview } from "@sast-shop/api";
import { getServerServiceOptions } from "@/lib/server-service-options";

export const loadProfileOverview = cache(async () =>
  getProfileOverview(await getServerServiceOptions()),
);
