import Link from "next/link";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFileList3Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

export function TaskTerminalState({
  status,
}: {
  status: "completed" | "cancelled" | "unsupported";
}) {
  const completed = status === "completed";
  const cancelled = status === "cancelled";
  return (
    <Empty
      icon={
        completed ? (
          <RiCheckboxCircleLine className="size-5" />
        ) : cancelled ? (
          <RiCloseCircleLine className="size-5" />
        ) : (
          <RiFileList3Line className="size-5" />
        )
      }
      title={
        completed
          ? "采购任务已完成"
          : cancelled
            ? "采购任务已取消"
            : "任务状态暂不可用"
      }
      description={
        completed || cancelled
          ? undefined
          : "当前任务状态无法识别，请刷新任务列表。"
      }
      action={
        <Button asChild>
          <Link href="/orders?type=errand&view=captain">返回任务列表</Link>
        </Button>
      }
    />
  );
}
