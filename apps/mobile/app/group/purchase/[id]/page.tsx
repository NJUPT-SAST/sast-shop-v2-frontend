import { RiFileList3Line } from "@remixicon/react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

type PurchaseTaskPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function PurchaseTaskPage({
  params,
}: PurchaseTaskPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="采购任务已创建"
        description={`任务 #${id} 已进入正在采购。采购清单处理会在下一步接入。`}
        action={
          <Button asChild>
            <Link href="/group">返回团购</Link>
          </Button>
        }
      />
    </div>
  )
}
