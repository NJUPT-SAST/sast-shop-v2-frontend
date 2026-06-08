"use client"

import { useState } from "react"
import type { DataSource, ProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { formatProfileDataSource } from "@/lib/profile-view"

type ActiveDialog = "addresses" | "qr-codes" | null

interface ProfileManagementClientProps {
  dataSource: DataSource
  overview: ProfileOverview | null
  error: string | null
}

export function ProfileManagementClient({
  dataSource,
  overview,
  error,
}: ProfileManagementClientProps) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const title = activeDialog === "addresses" ? "地址簿" : "快捷收款码"

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveDialog("addresses")}
        >
          地址簿
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveDialog("qr-codes")}
        >
          收款码
        </Button>
      </div>

      <Dialog
        open={activeDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveDialog(null)
          }
        }}
      >
        <DialogContent className="max-h-[78dvh] overflow-y-auto sm:max-w-3xl">
          {activeDialog ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl leading-7">{title}</DialogTitle>
                <DialogDescription>
                  {error ?? `数据源：${formatProfileDataSource(dataSource)}`}
                </DialogDescription>
              </DialogHeader>

              {error ? (
                <p className="rounded-lg border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
                  {error}
                </p>
              ) : null}

              {!error && activeDialog === "addresses" ? (
                <AddressTable overview={overview} />
              ) : null}

              {!error && activeDialog === "qr-codes" ? (
                <QrCodeTable overview={overview} />
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddressTable({ overview }: { overview: ProfileOverview | null }) {
  if (!overview || overview.addresses.length === 0) {
    return (
      <p className="rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
        暂无地址。后续开放新增能力后，可在这里维护常用地址。
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {overview.addresses.map((address) => (
        <div
          key={address.id}
          className="grid min-h-14 grid-cols-[7rem_8rem_minmax(0,1fr)_5rem_9rem] items-center gap-4 rounded-lg border border-border px-4"
        >
          <p className="truncate font-medium">{address.recipientName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {address.recipientPhone}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {formatAddress(address)}
          </p>
          {address.isDefault ? <Badge>默认</Badge> : <span />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled>
              编辑待开放
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled>
              删除待开放
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function QrCodeTable({ overview }: { overview: ProfileOverview | null }) {
  if (!overview || overview.paymentQrCodes.length === 0) {
    return (
      <p className="rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
        暂无收款码。后续开放修改能力后，可在这里维护微信和支付宝收款信息。
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {overview.paymentQrCodes.map((qrCode) => (
        <div
          key={qrCode.id}
          className="grid min-h-14 grid-cols-[8rem_minmax(0,1fr)_7rem] items-center gap-4 rounded-lg border border-border px-4"
        >
          <p className="font-medium">
            {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {qrCode.content}
          </p>
          <Button type="button" variant="outline" size="sm" disabled>
            修改待开放
          </Button>
        </div>
      ))}
    </div>
  )
}

function formatAddress(
  address: ProfileOverview["addresses"][number]
): string {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`
}
