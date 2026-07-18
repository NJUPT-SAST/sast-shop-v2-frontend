import Link from "next/link"
import { RiStore2Line } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function GroupShopNotFound() {
  return (
    <Empty
      icon={<RiStore2Line className="size-5" />}
      title="没有找到这个店铺"
      description="店铺编号无效或已经下线。"
      action={
        <Button asChild>
          <Link href="/group">返回团购工作台</Link>
        </Button>
      }
    />
  )
}
