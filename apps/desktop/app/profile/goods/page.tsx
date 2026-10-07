import { randomUUID } from "node:crypto";
import { SellerGoodsManager } from "@/components/seller-goods-manager";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default function SellerGoodsPage() {
  return (
    <SellerGoodsManager
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      authRequired={getServerAuthMode() === "required"}
      refreshKey={randomUUID()}
    />
  );
}
