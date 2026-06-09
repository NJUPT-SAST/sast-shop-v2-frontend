"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  RiAddLine,
  RiAlipayLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiMapPinLine,
  RiPencilLine,
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
import {
  validatePaymentQrContent,
  type PaymentQrContentValidationReason,
} from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  getCityOptions,
  getDistrictOptions,
  getProvinceOptions,
} from "@/lib/mainland-address-regions"
import {
  DEFAULT_PAYMENT_PLATFORM,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences"
import { decodePaymentQrImage } from "@/lib/qr-image-decoder"

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
  const router = useRouter()
  const pathname = usePathname()
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDefaultPaymentPlatform(readDefaultPaymentPlatform())
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    let timeoutId: number | null = null
    const syncDialogFromLocation = () => {
      const dialog = getDialogFromLocation()

      timeoutId = window.setTimeout(() => {
        setAddressOpen(dialog === "address")
        setPaymentPreferenceOpen(dialog === "payment-preference")
        setQrOpen(dialog === "qr-code")
      }, 0)
    }

    syncDialogFromLocation()
    window.addEventListener("popstate", syncDialogFromLocation)

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener("popstate", syncDialogFromLocation)
    }
  }, [])

  function setDialogQuery(dialog: string | null) {
    const params = new URLSearchParams(window.location.search)

    if (dialog) {
      params.set("dialog", dialog)
    } else {
      params.delete("dialog")
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function updateDialogOpen(
    open: boolean,
    dialog: "address" | "payment-preference" | "qr-code",
    setOpen: (open: boolean) => void
  ) {
    setOpen(open)

    if (open) {
      setDialogQuery(dialog)
      return
    }

    if (getDialogFromLocation() === dialog) {
      setDialogQuery(null)
    }
  }

  function saveDefaultPaymentPlatform(platform: PaymentPlatform) {
    writeDefaultPaymentPlatform(platform)
    setDefaultPaymentPlatform(platform)
    toast.success("默认支付方式已更新")
  }

  async function runMutation(
    action: string,
    operation: () => Promise<void>,
    fallbackMessage: string
  ): Promise<boolean> {
    setMutationError(null)
    setPendingAction(action)

    try {
      await operation()
      return true
    } catch {
      setMutationError(fallbackMessage)
      return false
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
    return runMutation(
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
        openAddressDialog: () => updateDialogOpen(true, "address", setAddressOpen),
        openPaymentPreferenceDialog: () =>
          updateDialogOpen(true, "payment-preference", setPaymentPreferenceOpen),
        openQrCodeDialog: () => updateDialogOpen(true, "qr-code", setQrOpen),
      }}
    >
      {children}

      <ResponsiveDialog
        forceDrawer
        open={addressOpen}
        onOpenChange={(open) => updateDialogOpen(open, "address", setAddressOpen)}
      >
        <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <div className="mx-auto flex max-h-[calc(86dvh-2rem)] min-h-0 w-full max-w-md flex-col gap-4">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                地址簿
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                管理常用收货地址和默认地址
              </ResponsiveDialogDescription>
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

            <div className="app-scrollbar -mx-4 min-h-0 flex-1 overflow-y-auto px-4">
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
        onDelete={
          addressForm.address
            ? () => {
                const addressId = addressForm.address?.id
                setAddressForm((current) => ({ ...current, open: false }))

                if (addressId) {
                  setDeleteConfirm({ open: true, id: addressId })
                }
              }
            : undefined
        }
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

      <ResponsiveDialog
        forceDrawer
        open={qrOpen}
        onOpenChange={(open) => updateDialogOpen(open, "qr-code", setQrOpen)}
      >
        <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
          <div className="mx-auto flex max-h-[calc(86dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-y-auto">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                收款码
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="leading-6">
                上传或更改你的收款码
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
        onOpenChange={(open) =>
          updateDialogOpen(open, "payment-preference", setPaymentPreferenceOpen)
        }
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle className="text-lg">
                默认支付方式
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="leading-6">
                付款时优先选用的支付平台
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
  const [openActionId, setOpenActionId] = useState<string | null>(null)

  if (addresses.length === 0) {
    return (
      <Empty
        icon={<RiMapPinLine className="size-5" />}
        title="暂无收货地址"
        description="添加常用地址后，下单时可以更快填写收货信息。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.map((address) => (
        <SwipeableAddressItem
          key={address.id}
          address={address}
          open={openActionId === address.id}
          onOpenChange={(open) => setOpenActionId(open ? address.id : null)}
          onEdit={() => {
            setOpenActionId(null)
            onEdit(address)
          }}
          onDelete={() => {
            setOpenActionId(null)
            onDelete(address.id)
          }}
          onSetDefault={() => {
            setOpenActionId(null)
            onSetDefault(address.id)
          }}
        />
      ))}
    </div>
  )
}

function SwipeableAddressItem({
  address,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const swipedRef = useRef(false)
  const region = [address.province, address.city, address.district]
    .filter(Boolean)
    .join(" ")

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    swipedRef.current = false
    touchStartXRef.current = event.clientX
    touchStartYRef.current = event.clientY
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      return
    }

    const deltaX = event.clientX - touchStartXRef.current
    const deltaY = event.clientY - touchStartYRef.current

    touchStartXRef.current = null
    touchStartYRef.current = null

    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return
    }

    swipedRef.current = true
    onOpenChange(deltaX < 0)
  }

  function activateCard() {
    if (open) {
      onOpenChange(false)
      return
    }

    onEdit()
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    activateCard()
  }

  return (
    <div
      className="relative rounded-lg"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        touchStartXRef.current = null
        touchStartYRef.current = null
      }}
    >
      <div
        className={cn(
          "absolute inset-y-0 right-2 z-10 flex translate-x-4 items-center gap-2 opacity-0 transition-all duration-200 ease-out pointer-events-none",
          open && "translate-x-0 opacity-100 pointer-events-auto"
        )}
        aria-hidden={!open}
      >
        <Button
          type="button"
          variant="default"
          size="icon-lg"
          className="rounded-full"
          disabled={address.isDefault}
          tabIndex={open ? 0 : -1}
          onClick={onSetDefault}
        >
          <RiCheckLine />
          <span className="sr-only">设为默认</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          className="rounded-full"
          tabIndex={open ? 0 : -1}
          onClick={onEdit}
        >
          <RiPencilLine />
          <span className="sr-only">编辑地址</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon-lg"
          className="rounded-full"
          tabIndex={open ? 0 : -1}
          onClick={onDelete}
        >
          <RiDeleteBinLine />
          <span className="sr-only">删除地址</span>
        </Button>
      </div>

      <Card
        role="button"
        tabIndex={0}
        aria-label={`编辑${address.recipientName}的地址`}
        className={cn(
          "relative cursor-pointer rounded-lg transition-transform duration-200 ease-out touch-pan-y outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "-translate-x-[168px]"
        )}
        onKeyDown={handleCardKeyDown}
        onClick={() => {
          if (swipedRef.current) {
            swipedRef.current = false
            return
          }

          activateCard()
        }}
      >
        {address.isDefault ? (
          <Badge className="absolute top-3 right-3 bg-primary/10 text-primary">
            默认
          </Badge>
        ) : null}
        <CardContent className="flex items-start gap-3 p-3 pr-16">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted",
              address.isDefault && "bg-primary/10"
            )}
          >
            <RiMapPinLine
              className={cn(
                "size-5 text-muted-foreground",
                address.isDefault && "text-primary"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{address.recipientName}</span>
              <span className="text-sm text-muted-foreground">
                {address.recipientPhone}
              </span>
            </div>
            <p className="mt-1 truncate text-sm leading-5 text-muted-foreground">
              {region}
            </p>
            <p className="mt-1 truncate text-sm leading-5 text-muted-foreground">
              {address.detailAddress}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AddressFormDialog({
  open,
  mode,
  address,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean
  mode: "add" | "edit"
  address?: Address
  onOpenChange: (open: boolean) => void
  onSave: (input: AddressInput) => Promise<void>
  onDelete?: () => void
}) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[86dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
        <div className="mx-auto max-h-[calc(86dvh-2rem)] w-full max-w-md overflow-y-auto">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle className="text-xl">
              {mode === "add" ? "添加地址" : "编辑地址"}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <AddressForm
            key={open ? `${mode}-${address?.id ?? "new"}` : "closed"}
            address={address}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
            onDelete={onDelete}
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
  onDelete,
}: {
  address?: Address
  onCancel: () => void
  onSave: (input: AddressInput) => Promise<void>
  onDelete?: () => void
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
  const provinceOptions = getProvinceOptions()
  const cityOptions = getCityOptions(form.province)
  const districtOptions = getDistrictOptions(form.province, form.city)

  function updateField(field: keyof AddressInput, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateProvince(province: string) {
    setForm((current) => {
      const nextCityOptions = getCityOptions(province)
      const city = nextCityOptions.some((option) => option.label === current.city)
        ? current.city
        : ""
      const nextDistrictOptions = city ? getDistrictOptions(province, city) : []
      const district = nextDistrictOptions.some(
        (option) => option.label === current.district
      )
        ? current.district
        : ""

      return { ...current, province, city, district }
    })
  }

  function updateCity(city: string) {
    setForm((current) => {
      const nextDistrictOptions = getDistrictOptions(current.province, city)
      const district = nextDistrictOptions.some(
        (option) => option.label === current.district
      )
        ? current.district
        : ""

      return { ...current, city, district }
    })
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
            <Select value={form.province} onValueChange={updateProvince}>
              <SelectTrigger id="province">
                <SelectValue placeholder="选择省" />
              </SelectTrigger>
              <SelectContent>
                {provinceOptions.map((option) => (
                  <SelectItem key={option.code} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="城市" htmlFor="city">
            <Select
              value={form.city}
              onValueChange={updateCity}
              disabled={!form.province}
            >
              <SelectTrigger id="city">
                <SelectValue placeholder="选择市" />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((option) => (
                  <SelectItem key={option.code} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="区/县" htmlFor="district">
            <Select
              value={form.district}
              onValueChange={(district) => updateField("district", district)}
              disabled={!form.city}
            >
              <SelectTrigger id="district">
                <SelectValue placeholder="选择区" />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map((option) => (
                  <SelectItem key={option.code} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <div className="flex min-h-9 items-center justify-between gap-3">
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 py-1 text-destructive hover:bg-transparent hover:text-destructive/80"
              onClick={onDelete}
            >
              <RiDeleteBinLine data-icon="inline-start" />
              删除地址
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="isDefault"
              checked={form.isDefault}
              onCheckedChange={(checked) => updateField("isDefault", checked)}
            />
            <Label htmlFor="isDefault">设为默认地址</Label>
          </div>
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
  onUpsert: (channel: PaymentQrChannel, content: string) => Promise<boolean>
}) {
  const channels: Array<{
    channel: PaymentQrChannel
    label: string
    iconClassName: string
    icon: typeof RiWechatPayLine
  }> = [
    {
      channel: "wechat",
      label: "微信支付",
      iconClassName: "bg-[#07c160] text-white",
      icon: RiWechatPayLine,
    },
    {
      channel: "alipay",
      label: "支付宝",
      iconClassName: "bg-[#1677ff] text-white",
      icon: RiAlipayLine,
    },
  ]

  return (
    <div className="flex flex-col gap-3 py-1">
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
  iconClassName,
  icon: Icon,
  qrCode,
  pending,
  onUpsert,
}: {
  channel: PaymentQrChannel
  label: string
  iconClassName: string
  icon: typeof RiWechatPayLine
  qrCode?: PaymentQrCode
  pending: boolean
  onUpsert: (channel: PaymentQrChannel, content: string) => Promise<boolean>
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await decodePaymentQrImage(file)
      const validation = validatePaymentQrContent(channel, content)

      if (!validation.ok) {
        toast.error(getQrContentValidationMessage(label, validation.reason))
        return
      }

      const saved = await onUpsert(channel, validation.content)

      if (saved) {
        toast.success(`${label}收款码已保存`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "二维码解析失败")
    } finally {
      event.target.value = ""
    }
  }

  const uploaded = Boolean(qrCode)

  return (
    <>
      <button
        type="button"
        className="relative w-full rounded-lg border bg-card p-4 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={pending}
        aria-label={`${uploaded ? "更改" : "上传"}${label}收款码`}
        onClick={() => inputRef.current?.click()}
      >
        <Badge
          className={cn(
            "absolute top-4 right-4",
            uploaded ? "bg-green-50 text-green-700" : "bg-sky-50 text-sky-700"
          )}
        >
          {uploaded ? "已上传" : "未上传"}
        </Badge>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              iconClassName
            )}
          >
            <Icon data-icon="inline-start" />
          </div>
          <div className="min-w-0 flex-1 pr-20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{label}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {pending
                ? "保存中"
                : uploaded
                  ? "点击更改收款码"
                  : "点击上传收款码"}
            </p>
          </div>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
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
    description: string
    selectedCardClassName: string
    selectedDescriptionClassName: string
    selectedIconClassName: string
    selectedRadioClassName: string
    icon: typeof RiWechatPayLine
  }> = [
    {
      platform: "wechat",
      label: "微信支付",
      description: "适合常用微信付款",
      selectedCardClassName:
        "border-[#07c160] bg-[#07c160]/8 hover:bg-[#07c160]/8",
      selectedDescriptionClassName: "text-[#047a3d]",
      selectedIconClassName: "bg-[#07c160] text-white",
      selectedRadioClassName:
        "data-[state=checked]:border-[#07c160] data-[state=checked]:bg-[#07c160]",
      icon: RiWechatPayLine,
    },
    {
      platform: "alipay",
      label: "支付宝",
      description: "适合常用支付宝付款",
      selectedCardClassName:
        "border-[#1677ff] bg-[#1677ff]/8 hover:bg-[#1677ff]/8",
      selectedDescriptionClassName: "text-[#0f5dcc]",
      selectedIconClassName: "bg-[#1677ff] text-white",
      selectedRadioClassName:
        "data-[state=checked]:border-[#1677ff] data-[state=checked]:bg-[#1677ff]",
      icon: RiAlipayLine,
    },
  ]

  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label" className="sr-only">
        默认支付方式
      </FieldLegend>
      <FieldDescription className="sr-only">
        付款时优先选用的支付平台
      </FieldDescription>
      <RadioGroup
        value={defaultPaymentPlatform}
        onValueChange={(value) => onSelect(value as PaymentPlatform)}
        className="gap-3"
      >
        {platforms.map(({
          platform,
          label,
          description,
          selectedCardClassName,
          selectedDescriptionClassName,
          selectedIconClassName,
          selectedRadioClassName,
          icon: Icon,
        }) => {
          const selected = platform === defaultPaymentPlatform
          const id = `payment-platform-${platform}`

          return (
            <FieldLabel
              key={platform}
              htmlFor={id}
              className={cn(
                "w-full cursor-pointer rounded-lg border bg-card p-0 text-foreground transition-colors hover:bg-accent/60",
                selected && selectedCardClassName
              )}
            >
              <UiField
                orientation="horizontal"
                className="min-h-[76px] items-center gap-3 px-4 py-3"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground",
                    selected && selectedIconClassName
                  )}
                >
                  <Icon data-icon="inline-start" />
                </span>
                <FieldContent>
                  <FieldTitle className="text-base">{label}</FieldTitle>
                  <FieldDescription
                    className={cn(selected && selectedDescriptionClassName)}
                >
                  {description}
                </FieldDescription>
              </FieldContent>
                <RadioGroupItem
                  id={id}
                  value={platform}
                  className={cn("ml-auto", selectedRadioClassName)}
                />
              </UiField>
            </FieldLabel>
          )
        })}
      </RadioGroup>
    </FieldSet>
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

function getDialogFromLocation() {
  return new URLSearchParams(window.location.search).get("dialog")
}

function getQrContentValidationMessage(
  label: string,
  reason: PaymentQrContentValidationReason
) {
  if (reason === "too-long") {
    return "二维码内容过长，请换一个收款码"
  }

  if (reason === "control-character") {
    return "二维码内容包含不支持的字符"
  }

  return `这不是${label}收款码，请重新上传`
}
