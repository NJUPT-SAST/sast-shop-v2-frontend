"use client"

import { useState } from "react"
import type { ProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type ActivePanel = "addresses" | "qr-codes" | null

interface ProfileManagementClientProps {
  dataSource: string
  overview: ProfileOverview | null
  error: string | null
}

export function ProfileManagementClient({
  dataSource,
  overview,
  error,
}: ProfileManagementClientProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const title = activePanel === "addresses" ? "地址簿" : "快捷收款码"
  const titleId =
    activePanel === "addresses"
      ? "profile-addresses-title"
      : "profile-qr-codes-title"

  return (
    <>
      <div className="border-t border-border/80 bg-card/95 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setActivePanel("addresses")}
          >
            地址簿
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setActivePanel("qr-codes")}
          >
            收款码
          </Button>
        </div>
      </div>

      {activePanel ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[82dvh] w-full overflow-y-auto rounded-t-lg bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-lg"
          >
            <div className="mx-auto flex w-full max-w-md flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-lg font-semibold leading-6">
                    {title}
                  </h2>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {error ?? `数据源：${dataSource}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0 px-4"
                  onClick={() => setActivePanel(null)}
                >
                  关闭
                </Button>
              </div>

              {error ? (
                <p className="rounded-lg border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
                  {error}
                </p>
              ) : null}

              {!error && activePanel === "addresses" ? (
                <AddressPanel overview={overview} />
              ) : null}

              {!error && activePanel === "qr-codes" ? (
                <QrCodePanel overview={overview} />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

function AddressPanel({ overview }: { overview: ProfileOverview | null }) {
  const addresses = overview?.addresses ?? []

  return (
    <div className="grid gap-3">
      {addresses.length > 0 ? (
        addresses.map((address) => (
          <article
            key={address.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium">
                  {address.recipientName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {address.recipientPhone}
                </p>
              </div>
              {address.isDefault ? (
                <Badge className="shrink-0">默认</Badge>
              ) : null}
            </div>
            <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
              {formatAddress(address)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-label="编辑地址暂未开放"
                title="编辑地址暂未开放"
              >
                编辑待开放
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-label="删除地址暂未开放"
                title="删除地址暂未开放"
              >
                删除待开放
              </Button>
            </div>
          </article>
        ))
      ) : (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
          暂无地址。新增地址能力接入后，可在这里维护常用收货信息。
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="min-h-11"
        disabled
        aria-label="新增地址暂未开放"
        title="新增地址暂未开放"
      >
        新增地址待开放
      </Button>
    </div>
  )
}

function QrCodePanel({ overview }: { overview: ProfileOverview | null }) {
  const qrCodes = overview?.paymentQrCodes ?? []

  return (
    <div className="grid gap-3">
      {qrCodes.length > 0 ? (
        qrCodes.map((qrCode) => (
          <article
            key={qrCode.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">
                {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
              </p>
              <Badge variant="outline" className="shrink-0">
                只能修改
              </Badge>
            </div>
            <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
              {qrCode.content}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled
              aria-label="修改收款码暂未开放"
              title="修改收款码暂未开放"
            >
              修改待开放
            </Button>
          </article>
        ))
      ) : (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
          暂无收款码。修改能力接入后，可在这里维护微信支付和支付宝内容。
        </p>
      )}
    </div>
  )
}

function formatAddress(address: ProfileOverview["addresses"][number]) {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`
}
