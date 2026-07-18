"use client"

import Link from "next/link"
import { RiErrorWarningLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function BuyerErrandOrderError({ reset }: { reset: () => void }) {
  return (
    <Empty
      icon={<RiErrorWarningLine className="size-5" />}
      title="跑腿订单加载失败"
      description="数据服务暂时不可用，请重试。"
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>重新加载</Button>
          <Button asChild><Link href="/orders?type=errand">返回订单</Link></Button>
        </div>
      }
    />
  )
}
