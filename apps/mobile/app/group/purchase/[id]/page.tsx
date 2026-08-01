import {
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail,
} from "@sast-shop/api";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFileList3Line,
} from "@remixicon/react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";
import { notFound, redirect } from "next/navigation";

import { DistributingTaskView } from "@/components/errand-purchase/distributing-task-view";
import { ShoppingTaskView } from "@/components/errand-purchase/shopping-task-view";
import { mobileAppConfig } from "@/lib/app-config";
import {
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "@/lib/errand-task-route";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

type PurchaseTaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseTaskPage({
  params,
}: PurchaseTaskPageProps) {
  const { id } = await params;
  if (!isValidRouteId(id)) notFound();

  const serviceOptions = await getServerServiceOptions();
  const task = await getErrandTaskBrief(id, serviceOptions);
  const state = resolveErrandTaskPage(task ? [task] : [], id);

  if (!state) notFound();

  const routeDecision = resolveErrandTaskRoute(id, "main", state);
  if (routeDecision.kind === "redirect") redirect(routeDecision.href);

  if (state.kind === "shopping") {
    const detail = await getShoppingTaskDetail(id, serviceOptions);

    return (
      <ShoppingTaskView
        dataSource={mobileAppConfig.dataSource}
        connectBaseUrl={mobileAppConfig.connectBaseUrl}
        detail={detail}
      />
    );
  }

  if (state.kind === "distributing") {
    const detail = await getDistributingTaskDetail(id, serviceOptions);

    return (
      <DistributingTaskView
        dataSource={mobileAppConfig.dataSource}
        connectBaseUrl={mobileAppConfig.connectBaseUrl}
        detail={detail}
        mode={state.mode}
      />
    );
  }

  if (state.kind === "terminal" && state.status === "completed") {
    return (
      <TaskStatus
        icon={<RiCheckboxCircleLine className="size-5" />}
        title="采购任务已完成"
      />
    );
  }

  if (state.kind === "terminal" && state.status === "cancelled") {
    return (
      <TaskStatus
        icon={<RiCloseCircleLine className="size-5" />}
        title="采购任务已取消"
      />
    );
  }

  return (
    <TaskStatus
      icon={<RiFileList3Line className="size-5" />}
      title="任务状态暂不可用"
      description="当前任务状态无法识别，请返回任务列表刷新后重试。"
    />
  );
}

function TaskStatus({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={icon}
        title={title}
        description={description}
        action={
          <Button asChild>
            <Link href="/orders?type=errand&view=captain">返回任务列表</Link>
          </Button>
        }
      />
    </div>
  );
}
