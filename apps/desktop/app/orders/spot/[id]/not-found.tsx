import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function NotFound() {
  return <Empty title="没有找到这笔订单" description="订单可能已删除，或链接中的编号不正确。" action={<Button asChild><Link href="/orders">返回订单列表</Link></Button>} />
}
