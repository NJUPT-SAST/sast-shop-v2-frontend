import { Skeleton } from "@workspace/ui/components/skeleton";
import ErrandDemandDetailLoading from "@/app/group/errand/[storeId]/loading";
import CollectingPaymentLoading from "@/app/group/purchase/[id]/payment/loading";
import PurchaseTaskLoading from "@/app/group/purchase/[id]/loading";
import GroupShopLoading from "@/app/group/shop/[id]/loading";
import BuyerErrandOrderLoading from "@/app/orders/errand/[id]/loading";
import SpotOrderLoading from "@/app/orders/spot/[id]/loading";
import PublishSpotLoading from "@/app/publish/spot/loading";
import ErrandDemandHallLoading from "./errand-lobby-skeleton";
import { MobilePageSkeleton } from "./mobile-page-skeleton";
import { MobileRouteSkeleton } from "./mobile-route-skeleton";

export function MobileNavigationSkeleton({ pathname }: { pathname: string }) {
  const path = pathname.replace(/\/+$/, "") || "/";

  switch (path) {
    case "/":
    case "/shop":
      return <MobilePageSkeleton variant="shop" />;
    case "/group":
      return <MobilePageSkeleton variant="group" />;
    case "/orders":
    case "/pocket":
      return <MobilePageSkeleton variant="orders" />;
    case "/profile":
      return <MobilePageSkeleton variant="profile" />;
    case "/group/errand":
      return <ErrandDemandHallLoading />;
    case "/group/templates":
      return <MobileRouteSkeleton variant="templates" />;
    case "/profile/goods":
      return <MobileRouteSkeleton variant="goods" />;
    case "/profile/face":
      return <MobileRouteSkeleton variant="face" />;
    case "/pocket/new":
      return <MobileRouteSkeleton variant="pocket-create" />;
    case "/publish/spot":
      return <PublishSpotLoading />;
  }

  if (/^\/group\/purchase\/[^/]+\/payment$/.test(path)) {
    return <CollectingPaymentLoading />;
  }
  if (/^\/group\/purchase\/[^/]+$/.test(path)) {
    return <PurchaseTaskLoading />;
  }
  if (/^\/group\/shop\/[^/]+$/.test(path)) {
    return <GroupShopLoading />;
  }
  if (/^\/group\/errand\/[^/]+$/.test(path)) {
    return <ErrandDemandDetailLoading />;
  }
  if (/^\/orders\/spot\/[^/]+$/.test(path)) {
    return <SpotOrderLoading />;
  }
  if (/^\/orders\/errand\/[^/]+$/.test(path)) {
    return <BuyerErrandOrderLoading />;
  }
  if (/^\/pocket\/[^/]+\/capture$/.test(path)) {
    return <MobileRouteSkeleton variant="pocket-capture" />;
  }
  if (/^\/pocket\/[^/]+(?:\/pay)?$/.test(path)) {
    return <MobileRouteSkeleton variant="pocket-detail" />;
  }

  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-4 py-4"
      role="status"
      aria-label="页面加载中"
    >
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
