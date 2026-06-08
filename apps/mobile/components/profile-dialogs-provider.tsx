"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import {
  RiAddLine,
  RiAlipayLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiImageLine,
  RiMapPinLine,
  RiPencilLine,
  RiQrCodeLine,
  RiUploadLine,
  RiWechatPayLine,
} from "@remixicon/react"
import {
  createAddress,
  deleteAddress as deleteSavedAddress,
  updateAddress,
  updatePaymentQrCode,
  type DataSource,
  type PaymentQrChannel,
  type ProfileOverview,
  type ServiceOptions,
} from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  DEFAULT_PAYMENT_PLATFORM,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences"
import { ManagedImage } from "./managed-image"

type Address = ProfileOverview["addresses"][number]
type AddressInput = Omit<Address, "id">
type PaymentQrCode = ProfileOverview["paymentQrCodes"][number]

interface ProfileDialogsContextValue {
  openAddressDialog: () => void
  openPaymentPreferenceDialog: () => void
  openQrCodeDialog: () => void
}

const ProfileDialogsContext = createContext<ProfileDialogsContextValue | null>(
  null
)

export function useProfileDialogs() {
  const context = useContext(ProfileDialogsContext)

  if (!context) {
    throw new Error("useProfileDialogs must be used within ProfileDialogsProvider")
  }

  return context
}

export function ProfileDialogsProvider({
  children,
  dataSource,
  connectBaseUrl,
  overview,
  error,
}: {
  children: ReactNode
  dataSource: DataSource
  connectBaseUrl: string
  overview: ProfileOverview | null
  error: string | null
}) {
  const [addresses, setAddresses] = useState<Address[]>(
    () => overview?.addresses ?? []
  )
  const [qrCodes, setQrCodes] = useState<PaymentQrCode[]>(
    () => overview?.paymentQrCodes ?? []
  )
  const [addressOpen, setAddressOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [paymentPreferenceOpen, setPaymentPreferenceOpen] = useState(false)
  const [defaultPaymentPlatform, setDefaultPaymentPlatform] =
    useState<PaymentPlatform>(DEFAULT_PAYMENT_PLATFORM)
  const [addressForm, setAddressForm] = useState<{
    open: boolean
    mode: "add" | "edit"
    address?: Address
  }>({ open: false, mode: "add" })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    id?: string
  }>({ open: false })
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDefaultPaymentPlatform(readDefaultPaymentPlatform())
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  function saveDefaultPaymentPlatform(platform: PaymentPlatform) {
    writeDefaultPaymentPlatform(platform)
    setDefaultPaymentPlatform(platform)
    toast.success("默认支付方式已更新")
  }

  async function runMutation(
    action: string,
    operation: () => Promise<void>,
    fallbackMessage: string
  ) {
    setMutationError(null)
    setPendingAction(action)

    try {
      await operation()
    } catch {
      setMutationError(fallbackMessage)
    } finally {
      setPendingAction(null)
    }
  }

  function applySavedAddress(savedAddress: Address) {
    setAddresses((current) => {
      const normalized = savedAddress.isDefault
        ? current.map((address) => ({ ...address, isDefault: false }))
        : current
      const exists = normalized.some((address) => address.id === savedAddress.id)

      if (exists) {
        return normalized.map((address) =>
          address.id === savedAddress.id ? savedAddress : address
        )
      }

      return [...normalized, savedAddress]
    })
  }

  async function upsertAddress(input: AddressInput, id?: string) {
    await runMutation(
      id ? `address-edit-${id}` : "address-add",
      async () => {
        const savedAddress = id
          ? await updateAddress(id, input, serviceOptions)
          : await createAddress(input, serviceOptions)

        applySavedAddress(savedAddress)
        setAddressForm({ open: false, mode: "add" })
      },
      "地址保存失败，请稍后再试"
    )
  }

  async function deleteAddress(id: string) {
    await runMutation(
      `address-delete-${id}`,
      async () => {
        await deleteSavedAddress(id, serviceOptions)
        setAddresses((current) => current.filter((address) => address.id !== id))
        setDeleteConfirm({ open: false })
      },
      "地址删除失败，请稍后再试"
    )
  }

  async function setDefaultAddress(id: string) {
    const address = addresses.find((item) => item.id === id)

    if (!address) {
      return
    }

    await runMutation(
      `address-default-${id}`,
      async () => {
        const savedAddress = await updateAddress(
          id,
          { ...address, isDefault: true },
          serviceOptions
        )
        applySavedAddress(savedAddress)
      },
      "默认地址设置失败，请稍后再试"
    )
  }

  async function upsertQrCode(channel: PaymentQrChannel, content: string) {
    await runMutation(
      `qr-${channel}`,
      async () => {
        const savedQrCode = await updatePaymentQrCode(
          { channel, content },
          serviceOptions
        )

        setQrCodes((current) => {
          const exists = current.some(
            (qrCode) => qrCode.channel === savedQrCode.channel
          )

          if (exists) {
            return current.map((qrCode) =>
              qrCode.channel === savedQrCode.channel ? savedQrCode : qrCode
            )
          }

          return [...current, savedQrCode]
        })
      },
      "收款码保存失败，请稍后再试"
    )
  }

  return (
    <ProfileDialogsContext.Provider
      value={{
        openAddressDialog: () => setAddressOpen(true),
        openPaymentPreferenceDialog: () => setPaymentPreferenceOpen(true),
        openQrCodeDialog: () => setQrOpen(true),
      }}
    >
      {children}

      <ResponsiveDialog
        forceDrawer
        open={addressOpen}
        onOpenChange={setAddressOpen}
      >
        <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <div className="mx-auto flex max-h-[calc(86dvh-2rem)] min-h-0 w-full max-w-md flex-col gap-4">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                地址簿
              </ResponsiveDialogTitle>
              {error ? (
                <ResponsiveDialogDescription>
                  {error}
                </ResponsiveDialogDescription>
              ) : null}
              {mutationError ? (
                <ResponsiveDialogDescription className="text-destructive">
                  {mutationError}
                </ResponsiveDialogDescription>
              ) : null}
            </ResponsiveDialogHeader>

            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              <AddressList
                addresses={addresses}
                onEdit={(address) =>
                  setAddressForm({ open: true, mode: "edit", address })
                }
                onDelete={(id) => setDeleteConfirm({ open: true, id })}
                onSetDefault={setDefaultAddress}
              />
            </div>

            <ResponsiveDialogFooter>
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={pendingAction === "address-add"}
                onClick={() => setAddressForm({ open: true, mode: "add" })}
              >
                <RiAddLine data-icon="inline-start" />
                添加地址
              </Button>
            </ResponsiveDialogFooter>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AddressFormDialog
        open={addressForm.open}
        mode={addressForm.mode}
        address={addressForm.address}
        onOpenChange={(open) => setAddressForm((current) => ({ ...current, open }))}
        onSave={(input) => {
          return upsertAddress(input, addressForm.address?.id)
        }}
      />

      <ResponsiveDialog
        forceDrawer
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((current) => ({ ...current, open }))
        }
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>删除地址</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              删除后，这个收货地址不会再出现在地址簿中。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => setDeleteConfirm({ open: false })}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 flex-1"
              disabled={
                deleteConfirm.id
                  ? pendingAction === `address-delete-${deleteConfirm.id}`
                  : false
              }
              onClick={() => {
                if (deleteConfirm.id) {
                  void deleteAddress(deleteConfirm.id)
                }
              }}
            >
              删除地址
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog forceDrawer open={qrOpen} onOpenChange={setQrOpen}>
        <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
          <div className="mx-auto flex max-h-[calc(86dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-y-auto">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                快捷收款码
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="leading-6">
                上传无固定金额的个人收款码，团购结算时可直接调用。
              </ResponsiveDialogDescription>
              {mutationError ? (
                <ResponsiveDialogDescription className="text-destructive">
                  {mutationError}
                </ResponsiveDialogDescription>
              ) : null}
            </ResponsiveDialogHeader>

            <QrCodeList
              pendingAction={pendingAction}
              qrCodes={qrCodes}
              onUpsert={upsertQrCode}
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        forceDrawer
        open={paymentPreferenceOpen}
        onOpenChange={setPaymentPreferenceOpen}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                默认支付方式
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="leading-6">
                选择后，付款时会优先打开对应的扫码方式。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <PaymentPreferenceChoices
              defaultPaymentPlatform={defaultPaymentPlatform}
              onSelect={saveDefaultPaymentPlatform}
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </ProfileDialogsContext.Provider>
  )
}

function AddressList({
  addresses,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  addresses: Address[]
  onEdit: (address: Address) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}) {
  if (addresses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-card">
          <RiMapPinLine className="size-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">暂无收货地址</p>
        <p className="text-sm leading-6 text-muted-foreground">
          添加常用地址后，下单时可以更快填写收货信息。
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.map((address) => (
        <Card key={address.id} className="rounded-lg">
          <CardContent className="flex items-start gap-3 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <RiMapPinLine className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{address.recipientName}</span>
                <span className="text-sm text-muted-foreground">
                  {address.recipientPhone}
                </span>
                {address.isDefault ? (
                  <Badge variant="secondary" className="text-xs">
                    默认
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                {formatAddress(address)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                {address.isDefault ? (
                  <span />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
                    onClick={() => onSetDefault(address.id)}
                  >
                    <RiCheckLine data-icon="inline-start" />
                    设为默认
                  </Button>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-destructive"
                    onClick={() => onDelete(address.id)}
                  >
                    <RiDeleteBinLine data-icon="inline-start" />
                    删除
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
                    onClick={() => onEdit(address)}
                  >
                    <RiPencilLine data-icon="inline-start" />
                    编辑
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AddressFormDialog({
  open,
  mode,
  address,
  onOpenChange,
  onSave,
}: {
  open: boolean
  mode: "add" | "edit"
  address?: Address
  onOpenChange: (open: boolean) => void
  onSave: (input: AddressInput) => Promise<void>
}) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
        <div className="mx-auto max-h-[calc(86dvh-2rem)] w-full max-w-md overflow-y-auto">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>
              {mode === "add" ? "添加地址" : "编辑地址"}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <AddressForm
            key={open ? `${mode}-${address?.id ?? "new"}` : "closed"}
            address={address}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function AddressForm({
  address,
  onCancel,
  onSave,
}: {
  address?: Address
  onCancel: () => void
  onSave: (input: AddressInput) => Promise<void>
}) {
  const [form, setForm] = useState<AddressInput>(() => ({
    recipientName: address?.recipientName ?? "",
    recipientPhone: address?.recipientPhone ?? "",
    province: address?.province ?? "",
    city: address?.city ?? "",
    district: address?.district ?? "",
    detailAddress: address?.detailAddress ?? "",
    isDefault: address?.isDefault ?? false,
  }))
  const [saving, setSaving] = useState(false)

  function updateField(field: keyof AddressInput, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="收货人" htmlFor="recipientName">
            <Input
              id="recipientName"
              value={form.recipientName}
              onChange={(event) => updateField("recipientName", event.target.value)}
            />
          </Field>
          <Field label="联系电话" htmlFor="recipientPhone">
            <Input
              id="recipientPhone"
              inputMode="tel"
              value={form.recipientPhone}
              onChange={(event) =>
                updateField("recipientPhone", event.target.value)
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="省" htmlFor="province">
            <Input
              id="province"
              value={form.province}
              onChange={(event) => updateField("province", event.target.value)}
            />
          </Field>
          <Field label="城市" htmlFor="city">
            <Input
              id="city"
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
            />
          </Field>
          <Field label="区/县" htmlFor="district">
            <Input
              id="district"
              value={form.district}
              onChange={(event) => updateField("district", event.target.value)}
            />
          </Field>
        </div>
        <Field label="详细地址" htmlFor="detailAddress">
          <Textarea
            id="detailAddress"
            value={form.detailAddress}
            onChange={(event) =>
              updateField("detailAddress", event.target.value)
            }
          />
        </Field>
        <div className="flex items-center gap-2">
          <Switch
            id="isDefault"
            checked={form.isDefault}
            onCheckedChange={(checked) => updateField("isDefault", checked)}
          />
          <Label htmlFor="isDefault">设为默认地址</Label>
        </div>
      </div>
      <ResponsiveDialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          onClick={onCancel}
        >
          取消
        </Button>
        <Button
          type="button"
          className="min-h-11 flex-1"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await onSave(form)
            setSaving(false)
          }}
        >
          {saving ? "保存中" : "保存"}
        </Button>
      </ResponsiveDialogFooter>
    </>
  )
}

function QrCodeList({
  pendingAction,
  qrCodes,
  onUpsert,
}: {
  pendingAction: string | null
  qrCodes: PaymentQrCode[]
  onUpsert: (channel: PaymentQrChannel, content: string) => Promise<void>
}) {
  const channels: Array<{
    channel: PaymentQrChannel
    label: string
    icon: typeof RiWechatPayLine
  }> = [
    { channel: "wechat", label: "微信支付", icon: RiWechatPayLine },
    { channel: "alipay", label: "支付宝", icon: RiAlipayLine },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 py-1">
      {channels.map((item) => {
        const qrCode = qrCodes.find((code) => code.channel === item.channel)

        return (
          <QrCodeItem
            key={item.channel}
            {...item}
            qrCode={qrCode}
            pending={pendingAction === `qr-${item.channel}`}
            onUpsert={onUpsert}
          />
        )
      })}
    </div>
  )
}

function QrCodeItem({
  channel,
  label,
  icon: Icon,
  qrCode,
  pending,
  onUpsert,
}: {
  channel: PaymentQrChannel
  label: string
  icon: typeof RiWechatPayLine
  qrCode?: PaymentQrCode
  pending: boolean
  onUpsert: (channel: PaymentQrChannel, content: string) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await onUpsert(channel, await readFileAsDataUrl(file))
    event.target.value = ""
  }

  const isImageContent =
    qrCode?.content.startsWith("blob:") ||
    qrCode?.content.startsWith("data:image") ||
    qrCode?.content.startsWith("http")

  return (
    <div className="flex min-w-0 flex-col items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>

      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
        {qrCode && isImageContent ? (
          <ManagedImage
            src={qrCode.content}
            alt={label}
            className="size-full rounded-md bg-white"
            imageClassName="object-contain"
          />
        ) : qrCode ? (
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <RiQrCodeLine className="size-8" />
            <span className="text-xs">已配置</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <RiImageLine className="size-8 opacity-50" />
            <span className="text-xs">未上传</span>
          </div>
        )}
      </div>

      {qrCode && !isImageContent ? (
        <p className="w-full truncate text-center text-xs text-muted-foreground">
          {qrCode.content}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <RiUploadLine data-icon="inline-start" />
        {pending ? "保存中" : qrCode ? "修改" : "上传"}
      </Button>
    </div>
  )
}

function PaymentPreferenceChoices({
  defaultPaymentPlatform,
  onSelect,
}: {
  defaultPaymentPlatform: PaymentPlatform
  onSelect: (platform: PaymentPlatform) => void
}) {
  const platforms: Array<{
    platform: PaymentPlatform
    label: string
    icon: typeof RiWechatPayLine
  }> = [
    { platform: "wechat", label: "微信支付", icon: RiWechatPayLine },
    { platform: "alipay", label: "支付宝", icon: RiAlipayLine },
  ]

  return (
    <div className="flex flex-col gap-3">
      {platforms.map(({ platform, label, icon: Icon }) => {
        const selected = platform === defaultPaymentPlatform

        return (
          <Button
            key={platform}
            type="button"
            variant={selected ? "default" : "outline"}
            size="lg"
            className="h-auto min-h-14 justify-start gap-3 px-4 py-3"
            aria-pressed={selected}
            onClick={() => onSelect(platform)}
          >
            <Icon data-icon="inline-start" />
            <span className="flex-1 text-left">{label}</span>
            {selected ? (
              <Badge variant="secondary" className="shrink-0">
                当前
              </Badge>
            ) : null}
          </Button>
        )
      })}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function formatAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener("load", () => resolve(String(reader.result ?? "")))
    reader.addEventListener("error", () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}
