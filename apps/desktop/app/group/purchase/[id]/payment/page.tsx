import { getCollectingPaymentDetail, getErrandTaskBrief } from "@sast-shop/api";
import { notFound, redirect } from "next/navigation";

import { CollectingPaymentView } from "@/components/errand-purchase/collecting-payment-view";
import { desktopAppConfig } from "@/lib/app-config";
import {
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "@/lib/errand-task-route";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function PurchasePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] | undefined }>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const id = parsePositiveInt64RouteId(rawId);
  if (!id) notFound();

  const options = await getServerServiceOptions();
  const task = await getErrandTaskBrief(id, options);
  const state = resolveErrandTaskPage(task ? [task] : [], id);

  if (!state) notFound();
  const routeDecision = resolveErrandTaskRoute(id, "payment", state);
  if (routeDecision.kind === "redirect") redirect(routeDecision.href);
  const detail = await getCollectingPaymentDetail(id, options);

  return (
    <CollectingPaymentView
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
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
