"use client"

import Link from "next/link"
import { RiErrorWarningLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function PurchaseTaskError({ reset }: { reset: () => void }) {
  return <Empty icon={<RiErrorWarningLine className="size-5" />} title="采购任务加载失败" description="任务状态可能已变化，请重新加载。" action={<div className="flex gap-2"><Button variant="outline" onClick={reset}>重新加载</Button><Button asChild><Link href="/orders?type=errand&view=captain">返回任务列表</Link></Button></div>} />
}
