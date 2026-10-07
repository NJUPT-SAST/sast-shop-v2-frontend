import { randomUUID } from "node:crypto";
import { SellerGoodsManager } from "@/components/seller-goods-manager";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default function SellerGoodsPage() {
  return (
    <SellerGoodsManager
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      authRequired={getServerAuthMode() === "required"}
      refreshKey={randomUUID()}
    />
  );
}
