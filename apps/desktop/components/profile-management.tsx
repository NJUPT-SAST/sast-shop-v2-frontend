"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiAlipayLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMapPinLine,
  RiQuestionLine,
  RiQrCodeLine,
  RiStarLine,
  RiUpload2Line,
  RiWechatPayLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createAddress,
  deleteAddress,
  updateAddress,
  updatePaymentQrCode,
  type DataSource,
  type PaymentQrChannel,
  type PaymentQrCode,
  type ProfileOverview,
  type ServiceOptions,
  type ShippingAddress,
  type ShippingAddressInput,
} from "@sast-shop/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Switch } from "@workspace/ui/components/switch";

import {
  getCityOptions,
  getDistrictOptions,
  getProvinceOptions,
} from "@/lib/mainland-address-regions";
import { decodePaymentQrImage } from "@/lib/qr-image-decoder";

type AddressDraft = Omit<ShippingAddressInput, "isDefault"> & {
  isDefault: boolean;
};

export function ProfileManagement({
  initialOverview,
  error,
  dataSource,
  connectBaseUrl,
  feedbackFormUrl,
}: {
  initialOverview: ProfileOverview | null;
  error: string | null;
  dataSource: DataSource;
  connectBaseUrl: string;
  feedbackFormUrl: string | null;
}) {
  const router = useRouter();
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const [addresses, setAddresses] = useState(initialOverview?.addresses ?? []);
  const [qrCodes, setQrCodes] = useState(initialOverview?.paymentQrCodes ?? []);
  const [addressListOpen, setAddressListOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(
    null,
  );
  const [addressDraft, setAddressDraft] =
    useState<AddressDraft>(emptyAddress());
  const [deleteTarget, setDeleteTarget] = useState<ShippingAddress | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const user = initialOverview?.user;
  const cityOptions = getCityOptions(addressDraft.province);
  const districtOptions = getDistrictOptions(
    addressDraft.province,
    addressDraft.city,
  );

  function openAddressForm(address?: ShippingAddress) {
    setAddressListOpen(false);
    setEditingAddress(address ?? null);
    setAddressDraft(address ? { ...address } : emptyAddress());
    setFormError(null);
    setAddressFormOpen(true);
  }

  async function saveAddress() {
    const validation = validateAddress(addressDraft);
    if (validation) {
      setFormError(validation);
      return;
    }
    const action = editingAddress ? `edit-${editingAddress.id}` : "add";
    setPendingAction(action);
    setFormError(null);
    try {
      const saved = editingAddress
        ? await updateAddress(editingAddress.id, addressDraft, serviceOptions)
        : await createAddress(addressDraft, serviceOptions);
      setAddresses((current) => applySavedAddress(current, saved));
      setAddressFormOpen(false);
      toast.success(editingAddress ? "地址已更新" : "地址已添加");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "地址保存失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeAddress() {
    if (!deleteTarget) return;
    setPendingAction(`delete-${deleteTarget.id}`);
    try {
      await deleteAddress(deleteTarget.id, serviceOptions);
      setAddresses((current) =>
        current.filter((address) => address.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      toast.success("地址已删除");
    } catch {
      toast.error("地址删除失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function makeDefault(address: ShippingAddress) {
    if (address.isDefault) return;
    setPendingAction(`default-${address.id}`);
    try {
      const saved = await updateAddress(
        address.id,
        { ...address, isDefault: true },
        serviceOptions,
      );
      setAddresses((current) => applySavedAddress(current, saved));
      toast.success("默认地址已更新");
    } catch {
      toast.error("默认地址设置失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveQrCode(channel: PaymentQrChannel, file: File) {
    setPendingAction(`qr-${channel}`);
    try {
      const content = await decodePaymentQrImage(file);
      const saved = await updatePaymentQrCode(
        { channel, content },
        serviceOptions,
      );
      setQrCodes((current) => upsertQrCode(current, saved));
      toast.success(`${channel === "wechat" ? "微信" : "支付宝"}收款码已保存`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "收款码保存失败");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">我的资料</h1>
        {user ? (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="text-lg font-semibold">
                {user.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <p className="truncate text-lg font-semibold">{user.name}</p>
          </div>
        ) : null}
      </section>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>资料暂不可用</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{error}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
            >
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {initialOverview ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setQrOpen(true)}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex min-h-28 items-center gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RiQrCodeLine className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">收款码</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {qrCodes.length}/2 已上传
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
          <button
            type="button"
            className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setAddressListOpen(true)}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex min-h-28 items-center gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <RiMapPinLine className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">地址簿</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {addresses.length} 个地址
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
        </section>
      ) : null}

      {feedbackFormUrl ? (
        <Button variant="ghost" className="w-full justify-start" asChild>
          <a href={feedbackFormUrl} target="_blank" rel="noopener noreferrer">
            <RiQuestionLine data-icon="inline-start" />
            帮助与反馈
          </a>
        </Button>
      ) : null}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>收款码</DialogTitle>
            <DialogDescription className="sr-only">
              管理微信和支付宝收款码
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <QrCodeRow
              channel="wechat"
              label="微信支付"
              icon={RiWechatPayLine}
              uploaded={qrCodes.some((code) => code.channel === "wechat")}
              pending={pendingAction === "qr-wechat"}
              onSelect={saveQrCode}
            />
            <QrCodeRow
              channel="alipay"
              label="支付宝"
              icon={RiAlipayLine}
              uploaded={qrCodes.some((code) => code.channel === "alipay")}
              pending={pendingAction === "qr-alipay"}
              onSelect={saveQrCode}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addressListOpen} onOpenChange={setAddressListOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>地址簿</DialogTitle>
            <DialogDescription className="sr-only">
              管理收货地址
            </DialogDescription>
          </DialogHeader>
          {addresses.length === 0 ? (
            <Empty
              icon={<RiMapPinLine className="size-5" />}
              title="暂无收货地址"
            />
          ) : (
            <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="flex min-w-0 items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {address.recipientName}
                      </p>
                      {address.isDefault ? <Badge>默认</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {address.recipientPhone} · {formatAddress(address)}
                    </p>
                  </div>
                  {!address.isDefault ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`将${address.recipientName}的地址设为默认`}
                      disabled={pendingAction !== null}
                      onClick={() => void makeDefault(address)}
                    >
                      <RiStarLine />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`编辑${address.recipientName}的地址`}
                    onClick={() => openAddressForm(address)}
                  >
                    <RiEditLine />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`删除${address.recipientName}的地址`}
                    onClick={() => {
                      setAddressListOpen(false);
                      setDeleteTarget(address);
                    }}
                  >
                    <RiDeleteBinLine />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => openAddressForm()}>
              <RiAddLine data-icon="inline-start" />
              添加地址
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addressFormOpen} onOpenChange={setAddressFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "编辑地址" : "添加地址"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              填写收货地址
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="address-recipient">收件人</FieldLabel>
              <Input
                id="address-recipient"
                value={addressDraft.recipientName}
                onChange={(event) =>
                  setAddressDraft((current) => ({
                    ...current,
                    recipientName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="address-phone">手机号</FieldLabel>
              <Input
                id="address-phone"
                inputMode="tel"
                value={addressDraft.recipientPhone}
                onChange={(event) =>
                  setAddressDraft((current) => ({
                    ...current,
                    recipientPhone: event.target.value,
                  }))
                }
              />
            </Field>
            <RegionSelect
              id="address-province"
              label="省份"
              value={addressDraft.province}
              options={getProvinceOptions()}
              onValueChange={(province) =>
                setAddressDraft((current) => ({
                  ...current,
                  province,
                  city: "",
                  district: "",
                }))
              }
            />
            <RegionSelect
              id="address-city"
              label="城市"
              value={addressDraft.city}
              options={cityOptions}
              disabled={!addressDraft.province}
              onValueChange={(city) =>
                setAddressDraft((current) => ({
                  ...current,
                  city,
                  district: "",
                }))
              }
            />
            <RegionSelect
              id="address-district"
              label="区县"
              value={addressDraft.district}
              options={districtOptions}
              disabled={!addressDraft.city}
              onValueChange={(district) =>
                setAddressDraft((current) => ({ ...current, district }))
              }
            />
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="address-detail">详细地址</FieldLabel>
              <Input
                id="address-detail"
                value={addressDraft.detailAddress}
                onChange={(event) =>
                  setAddressDraft((current) => ({
                    ...current,
                    detailAddress: event.target.value,
                  }))
                }
              />
            </Field>
            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 sm:col-span-2">
              <span className="text-sm font-medium">默认地址</span>
              <Switch
                checked={addressDraft.isDefault}
                onCheckedChange={(isDefault) =>
                  setAddressDraft((current) => ({ ...current, isDefault }))
                }
              />
            </label>
            {formError ? (
              <FieldError className="sm:col-span-2">{formError}</FieldError>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddressFormOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => void saveAddress()}
            >
              {pendingAction?.startsWith("edit-") || pendingAction === "add" ? (
                <Spinner />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除地址？</DialogTitle>
            <DialogDescription>删除后无法恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingAction !== null}
              onClick={() => void removeAddress()}
            >
              {pendingAction?.startsWith("delete-") ? <Spinner /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QrCodeRow({
  channel,
  label,
  icon: Icon,
  uploaded,
  pending,
  onSelect,
}: {
  channel: PaymentQrChannel;
  label: string;
  icon: typeof RiWechatPayLine;
  uploaded: boolean;
  pending: boolean;
  onSelect: (channel: PaymentQrChannel, file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onSelect(channel, file);
  }
  return (
    <button
      type="button"
      className="flex min-h-16 items-center gap-3 rounded-lg border px-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      disabled={pending}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Icon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      {pending ? (
        <Spinner />
      ) : uploaded ? (
        <Badge variant="success">已上传</Badge>
      ) : (
        <RiUpload2Line className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}

function RegionSelect({
  id,
  label,
  value,
  options,
  disabled = false,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ code: string; label: string }>;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value || undefined}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={id}>
          <span className="truncate">{value || `选择${label}`}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.code} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function emptyAddress(): AddressDraft {
  return {
    recipientName: "",
    recipientPhone: "",
    province: "",
    city: "",
    district: "",
    detailAddress: "",
    isDefault: false,
  };
}

function validateAddress(address: AddressDraft): string | null {
  if (!address.recipientName.trim()) return "请输入收件人";
  if (!/^1[3-9]\d{9}$/.test(address.recipientPhone)) return "手机号格式不正确";
  if (!address.province || !address.city || !address.district)
    return "请选择完整地区";
  if (!address.detailAddress.trim()) return "请输入详细地址";
  return null;
}

function applySavedAddress(
  addresses: ShippingAddress[],
  saved: ShippingAddress,
): ShippingAddress[] {
  const normalized = saved.isDefault
    ? addresses.map((address) => ({ ...address, isDefault: false }))
    : addresses;
  const exists = normalized.some((address) => address.id === saved.id);
  return exists
    ? normalized.map((address) => (address.id === saved.id ? saved : address))
    : [saved, ...normalized];
}

function upsertQrCode(qrCodes: PaymentQrCode[], saved: PaymentQrCode) {
  const exists = qrCodes.some((qrCode) => qrCode.channel === saved.channel);
  return exists
    ? qrCodes.map((qrCode) =>
        qrCode.channel === saved.channel ? saved : qrCode,
      )
    : [...qrCodes, saved];
}

function formatAddress(address: ShippingAddress): string {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`;
}
