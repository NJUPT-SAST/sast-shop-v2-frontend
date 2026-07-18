import Link from "next/link"
import { RiStore2Line } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

export default function ErrandDemandDetailNotFound() {
  return (
    <Empty
      icon={<RiStore2Line className="size-5" />}
      title="没有找到这个店铺"
      description="店铺编号无效或需求已经下线。"
      action={
        <Button asChild>
          <Link href="/group/errand">返回跑腿大厅</Link>
        </Button>
      }
    />
  )
}
