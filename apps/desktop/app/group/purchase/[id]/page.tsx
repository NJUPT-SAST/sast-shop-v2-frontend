import {
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail,
} from "@sast-shop/api";
import { notFound, redirect } from "next/navigation";

import { DistributingTaskView } from "@/components/errand-purchase/distributing-task-view";
import { ShoppingTaskView } from "@/components/errand-purchase/shopping-task-view";
import { TaskTerminalState } from "@/components/errand-purchase/task-terminal-state";
import { desktopAppConfig } from "@/lib/app-config";
import {
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "@/lib/errand-task-route";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function PurchaseTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parsePositiveInt64RouteId(rawId);
  if (!id) notFound();

  const options = await getServerServiceOptions();
  const task = await getErrandTaskBrief(id, options);
  const state = resolveErrandTaskPage(task ? [task] : [], id);
  if (!state) notFound();
  const routeDecision = resolveErrandTaskRoute(id, "main", state);
  if (routeDecision.kind === "redirect") redirect(routeDecision.href);
  const shared = {
    dataSource: desktopAppConfig.dataSource,
    connectBaseUrl: desktopAppConfig.connectBaseUrl,
  };

  if (state.kind === "shopping") {
    const detail = await getShoppingTaskDetail(id, options);

    return (
      <ShoppingTaskView
        {...shared}
        detail={detail}
        taskUpdatedAt={detail.taskUpdatedAt ?? state.task.updatedAt}
      />
    );
  }
  if (state.kind === "distributing") {
    return (
      <DistributingTaskView
        {...shared}
        detail={await getDistributingTaskDetail(id, {
          ...options,
          taskItems: state.task.items,
          taskUpdatedAt: state.task.updatedAt,
        })}
        mode={state.mode}
      />
    );
  }
  if (state.kind === "terminal") {
    return <TaskTerminalState status={state.status} />;
  }
  return <TaskTerminalState status="unsupported" />;
}
