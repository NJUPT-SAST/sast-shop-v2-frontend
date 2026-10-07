"use client";

import {
  type ChangeEvent,
  useSyncExternalStore,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListedGoodsIcon } from "@workspace/ui/components/listed-goods-icon";
import { Separator } from "@workspace/ui/components/separator";
import {
  RiAddLine,
  RiAlipayLine,
  RiDeleteBinLine,
  RiEditLine,
  RiArrowRightSLine,
  RiMapPinLine,
  RiStarLine,
  RiUpload2Line,
  RiWechatPayLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  AuthRequiredError,
  createAddress,
  deleteAddress,
  isLarkClientEnvironment,
  listAddresses,
  listPaymentQrCodes,
  ResourceNotFoundError,
  updateAddress,
  updatePaymentQrCode,
  ValidationError,
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
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { Label } from "@workspace/ui/components/label";
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
import { LoadFailure } from "@workspace/ui/components/load-failure";
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
import {
  DEFAULT_PAYMENT_PLATFORM,
  isPaymentPlatform,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
  subscribePaymentPreference,
} from "@/lib/payment-preferences";
import { BrandIllustration } from "./brand-illustration";
import { useTransactionAgreement } from "./transaction-agreement-provider";

type AddressDraft = Omit<ShippingAddressInput, "isDefault"> & {
  isDefault: boolean;
};

export function ProfileManagement({
  initialOverview,
  error,
  initialAddressError = null,
  initialQrError = null,
  dataSource,
  connectBaseUrl,
  feedbackFormUrl,
}: {
  initialOverview: ProfileOverview | null;
  error: string | null;
  initialAddressError?: string | null;
  initialQrError?: string | null;
  dataSource: DataSource;
  connectBaseUrl: string;
  feedbackFormUrl: string | null;
}) {
  const router = useRouter();
  const { openAgreement } = useTransactionAgreement();
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const [addresses, setAddresses] = useState(initialOverview?.addresses ?? []);
  const [qrCodes, setQrCodes] = useState(initialOverview?.paymentQrCodes ?? []);
  const [addressError, setAddressError] = useState(initialAddressError);
  const [qrError, setQrError] = useState(initialQrError);
  const [loadingSection, setLoadingSection] = useState<
    "addresses" | "qr" | null
  >(null);
  const loadingRef = useRef(false);
  const actionRef = useRef(false);
  const [preferenceOpen, setPreferenceOpen] = useState(false);
  const defaultPlatform = useSyncExternalStore(
    subscribePaymentPreference,
    readDefaultPaymentPlatform,
    () => DEFAULT_PAYMENT_PLATFORM,
  );
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
  const [addressNeedsVerification, setAddressNeedsVerification] =
    useState(false);
  const unverifiedAddress = useRef<{
    draft: AddressDraft;
    id: string | null;
    knownIds: string[];
  } | null>(null);

  const [addressSnapshot, setAddressSnapshot] = useState({
    addresses: initialOverview?.addresses,
    error: initialAddressError,
  });
  const [qrSnapshot, setQrSnapshot] = useState({
    qrCodes: initialOverview?.paymentQrCodes,
    error: initialQrError,
  });
  if (
    !addressFormOpen &&
    !deleteTarget &&
    !pendingAction &&
    !loadingSection &&
    !addressNeedsVerification &&
    (addressSnapshot.addresses !== initialOverview?.addresses ||
      addressSnapshot.error !== initialAddressError)
  ) {
    setAddressSnapshot({
      addresses: initialOverview?.addresses,
      error: initialAddressError,
    });
    setAddresses(initialOverview?.addresses ?? []);
    setAddressError(initialAddressError);
  }
  if (
    !pendingAction &&
    !loadingSection &&
    (qrSnapshot.qrCodes !== initialOverview?.paymentQrCodes ||
      qrSnapshot.error !== initialQrError)
  ) {
    setQrSnapshot({
      qrCodes: initialOverview?.paymentQrCodes,
      error: initialQrError,
    });
    setQrCodes(initialOverview?.paymentQrCodes ?? []);
    setQrError(initialQrError);
  }

  const user = initialOverview?.user;
  const cityOptions = getCityOptions(addressDraft.province);
  const districtOptions = getDistrictOptions(
    addressDraft.province,
    addressDraft.city,
  );

  function openAddressForm(address?: ShippingAddress) {
    if (actionRef.current || loadingRef.current || addressError) return;
    setAddressListOpen(false);
    if (unverifiedAddress.current) {
      setAddressFormOpen(true);
      return;
    }
    setEditingAddress(address ?? null);
    setAddressDraft(address ? { ...address } : emptyAddress());
    setFormError(null);
    setAddressFormOpen(true);
  }

  async function saveAddress() {
    if (actionRef.current || addressNeedsVerification) return;
    const validation = validateAddress(addressDraft);
    if (validation) {
      setFormError(validation);
      return;
    }
    const action = editingAddress ? `edit-${editingAddress.id}` : "add";
    actionRef.current = true;
    setPendingAction(action);
    setFormError(null);
    try {
      const saved = editingAddress
        ? await updateAddress(editingAddress.id, addressDraft, serviceOptions)
        : await createAddress(addressDraft, serviceOptions);
      setAddresses((current) => applySavedAddress(current, saved));
      setAddressFormOpen(false);
      setAddressListOpen(true);
      toast.success(editingAddress ? "地址已更新" : "地址已添加");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "地址保存失败");
      if (
        caught instanceof ValidationError ||
        caught instanceof AuthRequiredError ||
        caught instanceof ResourceNotFoundError
      ) {
        return;
      }
      unverifiedAddress.current = {
        draft: addressDraft,
        id: editingAddress?.id ?? null,
        knownIds: addresses.map((address) => address.id),
      };
      setAddressNeedsVerification(true);
      await verifyAddressSave();
    } finally {
      actionRef.current = false;
      setPendingAction(null);
    }
  }

  async function verifyAddressSave() {
    const pending = unverifiedAddress.current;
    if (!pending || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingSection("addresses");
    try {
      const latest = await listAddresses(serviceOptions);
      const saved = latest.find(
        (address) =>
          (pending.id
            ? address.id === pending.id
            : !pending.knownIds.includes(address.id)) &&
          address.recipientName === pending.draft.recipientName &&
          address.recipientPhone === pending.draft.recipientPhone &&
          address.province === pending.draft.province &&
          address.city === pending.draft.city &&
          address.district === pending.draft.district &&
          address.detailAddress === pending.draft.detailAddress &&
          address.isDefault === pending.draft.isDefault,
      );
      setAddresses(latest);
      setAddressError(null);
      if (saved) {
        setAddressNeedsVerification(false);
        unverifiedAddress.current = null;
        setFormError(null);
        setAddressFormOpen(false);
        setAddressListOpen(true);
        toast.success(pending.id ? "地址已更新" : "地址已添加");
      }
    } catch {
      setFormError(
        (current) =>
          `${current ?? "保存结果待核实"}；暂时无法确认地址是否保存，请核实后再重试`,
      );
      setAddressError("保存结果待核实，请重新加载地址簿");
    } finally {
      loadingRef.current = false;
      setLoadingSection(null);
    }
  }

  async function removeAddress() {
    if (!deleteTarget || actionRef.current || addressNeedsVerification) return;
    actionRef.current = true;
    setPendingAction(`delete-${deleteTarget.id}`);
    try {
      await deleteAddress(deleteTarget.id, serviceOptions);
      setAddresses((current) =>
        current.filter((address) => address.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setAddressListOpen(true);
      toast.success("地址已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "地址删除失败");
    } finally {
      actionRef.current = false;
      setPendingAction(null);
    }
  }

  async function makeDefault(address: ShippingAddress) {
    if (address.isDefault || actionRef.current || addressNeedsVerification)
      return;
    actionRef.current = true;
    setPendingAction(`default-${address.id}`);
    try {
      const saved = await updateAddress(
        address.id,
        { ...address, isDefault: true },
        serviceOptions,
      );
      setAddresses((current) => applySavedAddress(current, saved));
      toast.success("默认地址已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "默认地址设置失败");
    } finally {
      actionRef.current = false;
      setPendingAction(null);
    }
  }

  async function saveQrCode(channel: PaymentQrChannel, file: File) {
    if (actionRef.current) return;
    actionRef.current = true;
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
      actionRef.current = false;
      setPendingAction(null);
    }
  }

  async function reloadSection(section: "addresses" | "qr") {
    if (loadingRef.current || actionRef.current) return;
    if (section === "addresses" && unverifiedAddress.current) {
      await verifyAddressSave();
      return;
    }
    loadingRef.current = true;
    setLoadingSection(section);
    try {
      if (section === "addresses") {
        setAddresses(await listAddresses(serviceOptions));
        setAddressError(null);
      } else {
        setQrCodes(await listPaymentQrCodes(serviceOptions));
        setQrError(null);
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "加载失败，请重试";
      if (section === "addresses") setAddressError(message);
      else setQrError(message);
    } finally {
      loadingRef.current = false;
      setLoadingSection(null);
    }
  }

  function closeAddressForm(open: boolean) {
    if (actionRef.current) return;
    setAddressFormOpen(open);
    if (!open) setAddressListOpen(true);
  }

  function closeDeleteDialog(open: boolean) {
    if (open || actionRef.current) return;
    setDeleteTarget(null);
    setAddressListOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center justify-between gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">我的</h1>
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
        <LoadFailure
          variant="compact"
          title="资料加载失败"
          description={error}
          onRetry={() => router.refresh()}
        />
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="profile-personal-title"
        >
          <h2 id="profile-personal-title" className="text-base font-semibold">
            个人资料
          </h2>
          <Card>
            <CardContent className="p-0">
              <ProfileEntry
                name="address"
                label="地址簿"
                description={
                  addressError
                    ? "加载失败，点击重试"
                    : `${addresses.length} 个收货地址`
                }
                disabled={!initialOverview}
                onClick={() => setAddressListOpen(true)}
              />
            </CardContent>
          </Card>
        </section>
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="profile-payment-title"
        >
          <h2 id="profile-payment-title" className="text-base font-semibold">
            支付与收款
          </h2>
          <Card>
            <CardContent className="p-0">
              <ProfileEntry
                name="wallet"
                label="默认支付方式"
                description={
                  defaultPlatform === "wechat" ? "微信支付" : "支付宝"
                }
                onClick={() => setPreferenceOpen(true)}
              />
              <Separator />
              <ProfileEntry
                name="collection"
                label="收款码"
                description={
                  qrError ? "加载失败，点击重试" : `${qrCodes.length}/2 已上传`
                }
                disabled={!initialOverview}
                onClick={() => setQrOpen(true)}
              />
            </CardContent>
          </Card>
        </section>
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="profile-goods-title"
        >
          <h2 id="profile-goods-title" className="text-base font-semibold">
            商品管理
          </h2>
          <Card>
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="h-auto min-h-20 w-full justify-start gap-3 rounded-xl px-4 py-3"
                asChild
              >
                <Link href="/profile/goods">
                  <span className="flex size-9 shrink-0 items-center justify-center">
                    <ListedGoodsIcon />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                    <span className="font-medium">我上架的商品</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      管理现货售价与库存
                    </span>
                  </span>
                  <RiArrowRightSLine className="text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="profile-help-title"
        >
          <h2 id="profile-help-title" className="text-base font-semibold">
            协议与帮助
          </h2>
          <Card>
            <CardContent className="p-0">
              <ProfileEntry
                name="transaction-agreement"
                label="交易协议"
                description="查看交易规则与双方责任"
                onClick={openAgreement}
              />
              {feedbackFormUrl ? <Separator /> : null}
              {feedbackFormUrl ? (
                <Button
                  variant="ghost"
                  className="h-auto min-h-20 w-full justify-start gap-3 rounded-none px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
                  asChild
                >
                  <a
                    href={feedbackFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      if (
                        !isLarkClientEnvironment(window.h5sdk) ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      window.location.assign(
                        `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(feedbackFormUrl)}`,
                      );
                    }}
                  >
                    <BrandIllustration name="help" size={32} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <span className="font-medium">帮助与反馈</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        反馈问题或建议
                      </span>
                    </span>
                    <RiArrowRightSLine className="text-muted-foreground" />
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={preferenceOpen} onOpenChange={setPreferenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>默认支付方式</DialogTitle>
            <DialogDescription>
              付款时优先使用此方式，收款人未提供时使用其他可用方式
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={defaultPlatform}
            aria-label="默认支付方式"
            onValueChange={(value) => {
              if (!isPaymentPlatform(value)) return;
              if (!writeDefaultPaymentPlatform(value)) {
                toast.error("浏览器无法保存设置，请检查存储权限");
                return;
              }
            }}
          >
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <RadioGroupItem id="default-payment-wechat" value="wechat" />
              <Label
                htmlFor="default-payment-wechat"
                className="flex flex-1 items-center gap-2"
              >
                <RiWechatPayLine className="size-5" />
                微信支付
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <RadioGroupItem id="default-payment-alipay" value="alipay" />
              <Label
                htmlFor="default-payment-alipay"
                className="flex flex-1 items-center gap-2"
              >
                <RiAlipayLine className="size-5" />
                支付宝
              </Label>
            </div>
          </RadioGroup>
        </DialogContent>
      </Dialog>

      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          if (!actionRef.current) setQrOpen(open);
        }}
      >
        <DialogContent showCloseButton={pendingAction === null}>
          <DialogHeader>
            <DialogTitle>收款码</DialogTitle>
            <DialogDescription className="sr-only">
              管理微信和支付宝收款码
            </DialogDescription>
          </DialogHeader>
          {qrError ? (
            <LoadFailure
              variant="compact"
              title="收款码加载失败"
              description={qrError}
              onRetry={() => void reloadSection("qr")}
              aria-busy={loadingSection === "qr"}
              retryLabel={loadingSection === "qr" ? "正在加载" : "重新加载"}
            />
          ) : (
            <div className="grid gap-3">
              <QrCodeRow
                channel="wechat"
                label="微信支付"
                icon={RiWechatPayLine}
                uploaded={qrCodes.some((code) => code.channel === "wechat")}
                disabled={pendingAction !== null}
                pending={pendingAction === "qr-wechat"}
                onSelect={saveQrCode}
              />
              <QrCodeRow
                channel="alipay"
                label="支付宝"
                icon={RiAlipayLine}
                uploaded={qrCodes.some((code) => code.channel === "alipay")}
                disabled={pendingAction !== null}
                pending={pendingAction === "qr-alipay"}
                onSelect={saveQrCode}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={addressListOpen}
        onOpenChange={(open) => {
          if (!actionRef.current) setAddressListOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>地址簿</DialogTitle>
            <DialogDescription className="sr-only">
              管理收货地址
            </DialogDescription>
          </DialogHeader>
          {addressError ? (
            <LoadFailure
              variant="compact"
              title="地址簿加载失败"
              description={addressError}
              onRetry={() => void reloadSection("addresses")}
              aria-busy={loadingSection === "addresses"}
              retryLabel={
                loadingSection === "addresses" ? "正在加载" : "重新加载"
              }
            />
          ) : addresses.length === 0 ? (
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
                      disabled={
                        pendingAction !== null || addressNeedsVerification
                      }
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
                    disabled={
                      pendingAction !== null || addressNeedsVerification
                    }
                    onClick={() => openAddressForm(address)}
                  >
                    <RiEditLine />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={
                      pendingAction !== null || addressNeedsVerification
                    }
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
            <Button
              type="button"
              disabled={
                pendingAction !== null ||
                loadingSection !== null ||
                Boolean(addressError)
              }
              onClick={() => openAddressForm()}
            >
              <RiAddLine data-icon="inline-start" />
              {addressNeedsVerification ? "继续核实保存" : "添加地址"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addressFormOpen} onOpenChange={closeAddressForm}>
        <DialogContent
          className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-2xl"
          showCloseButton={pendingAction === null}
        >
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "编辑地址" : "添加地址"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              填写收货地址
            </DialogDescription>
          </DialogHeader>
          <form
            id="desktop-address-form"
            aria-describedby={formError ? "desktop-address-error" : undefined}
            aria-busy={pendingAction !== null}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void saveAddress();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <fieldset
              disabled={pendingAction !== null || addressNeedsVerification}
              className="contents"
            >
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
                disabled={pendingAction !== null}
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
                disabled={!addressDraft.province || pendingAction !== null}
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
                disabled={!addressDraft.city || pendingAction !== null}
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
                  disabled={pendingAction !== null}
                  checked={addressDraft.isDefault}
                  onCheckedChange={(isDefault) =>
                    setAddressDraft((current) => ({ ...current, isDefault }))
                  }
                />
              </label>
            </fieldset>
            {formError ? (
              <FieldError
                id="desktop-address-error"
                role="alert"
                className="sm:col-span-2"
              >
                {formError}
              </FieldError>
            ) : null}
            {addressNeedsVerification ? (
              <Button
                type="button"
                variant="outline"
                className="sm:col-span-2"
                disabled={loadingSection !== null}
                onClick={() => void verifyAddressSave()}
              >
                {loadingSection === "addresses" ? <Spinner /> : null}
                核实保存结果
              </Button>
            ) : null}
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() => closeAddressForm(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="desktop-address-form"
              disabled={pendingAction !== null || addressNeedsVerification}
            >
              {pendingAction?.startsWith("edit-") || pendingAction === "add" ? (
                <Spinner />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={closeDeleteDialog}>
        <DialogContent showCloseButton={pendingAction === null}>
          <DialogHeader>
            <DialogTitle>删除地址？</DialogTitle>
            <DialogDescription>删除后无法恢复</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() => closeDeleteDialog(false)}
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
  disabled,
  onSelect,
}: {
  channel: PaymentQrChannel;
  label: string;
  icon: typeof RiWechatPayLine;
  uploaded: boolean;
  pending: boolean;
  disabled: boolean;
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
      disabled={disabled}
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

function ProfileEntry({
  name,
  label,
  description,
  onClick,
  disabled = false,
}: {
  name: Parameters<typeof BrandIllustration>[0]["name"];
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className="h-auto min-h-20 w-full justify-start gap-3 rounded-none px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
      onClick={onClick}
    >
      <BrandIllustration name={name} size={32} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
      <RiArrowRightSLine className="text-muted-foreground" />
    </Button>
  );
}
