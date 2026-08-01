import { getCollectingPaymentDetail, getErrandTaskBrief } from "@sast-shop/api";
import { notFound, redirect } from "next/navigation";

import { CollectingPaymentView } from "@/components/errand-purchase/collecting-payment-view";
import { mobileAppConfig } from "@/lib/app-config";
import {
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "@/lib/errand-task-route";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

type GroupPurchasePaymentPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    notice?: string | string[] | undefined;
  }>;
};

export default async function GroupPurchasePaymentPage({
  params,
  searchParams,
}: GroupPurchasePaymentPageProps) {
  const { id } = await params;
  const query = await searchParams;
  if (!isValidRouteId(id)) notFound();

  const serviceOptions = await getServerServiceOptions();
  const task = await getErrandTaskBrief(id, serviceOptions);
  const state = resolveErrandTaskPage(task ? [task] : [], id);

  if (!state) notFound();
  const routeDecision = resolveErrandTaskRoute(id, "payment", state);
  if (routeDecision.kind === "redirect") redirect(routeDecision.href);

  const detail = await getCollectingPaymentDetail(id, serviceOptions);

  return (
    <CollectingPaymentView
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      detail={detail}
      taskId={id}
      taskUpdatedAt={detail.taskUpdatedAt ?? state.task.updatedAt}
      billingNotice={getNotice(query.notice) === "billing_generation_failed"}
    />
  );
}

function getNotice(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
