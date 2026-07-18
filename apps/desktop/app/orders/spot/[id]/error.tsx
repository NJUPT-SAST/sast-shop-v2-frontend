"use client"

import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <Empty title="订单详情加载失败" description="网络异常或订单状态已更新，请重新加载。" action={<Button onClick={reset}>重新加载</Button>} />
}
