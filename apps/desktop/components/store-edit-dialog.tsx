"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiStore2Line,
  RiUpload2Line,
} from "@remixicon/react";
import {
  listStores,
  updateStore,
  ValidationError,
  type DataSource,
  type Store,
  type UpdateStorePatch,
} from "@sast-shop/api";
import { validateStoreCreateFields } from "@sast-shop/domain";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { uploadProductImage } from "@/lib/product-image-upload";

type StoreEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  dataSource: DataSource;
  connectBaseUrl?: string;
  onSaved: (store: Store) => void;
};

export function StoreEditDialog(props: StoreEditDialogProps) {
  return props.open ? (
    <StoreEditor
      key={`${props.dataSource}:${props.connectBaseUrl}:${props.storeId}`}
      {...props}
    />
  ) : null;
}

function StoreEditor({
  open,
  onOpenChange,
  storeId,
  dataSource,
  connectBaseUrl,
  onSaved,
}: StoreEditDialogProps) {
  const options = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [dataSource, connectBaseUrl],
  );
  const generation = useRef(0);
  const lock = useRef(false);
  const pendingPatch = useRef<UpdateStorePatch | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [baseline, setBaseline] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const validation = validateStoreCreateFields({ name, address });
  const fieldErrors = submitted && !validation.ok ? validation.errors : {};
  const disabled = loading || uploading || saving || pending;
  const dirty =
    baseline !== null &&
    (name.trim() !== baseline.name ||
      address.trim() !== baseline.address ||
      logoUrl !== baseline.logoUrl);

  const fetchLatest = useCallback(async () => {
    const stores = await listStores(options);
    const latest = stores.find((store) => store.id === storeId);
    if (!latest) throw new Error("店铺不存在，请返回团购刷新");
    return latest;
  }, [options, storeId]);

  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const current = generation.current;
    setLoading(true);
    setLoadError(false);
    try {
      const latest = await fetchLatest();
      if (current !== generation.current) return;
      setBaseline(latest);
      setName(latest.name);
      setAddress(latest.address);
      setLogoUrl(latest.logoUrl);
    } catch {
      if (current === generation.current) setLoadError(true);
    } finally {
      if (current === generation.current) {
        lock.current = false;
        setLoading(false);
      }
    }
  }, [fetchLatest]);

  useEffect(() => {
    const current = ++generation.current;
    lock.current = true;
    void fetchLatest()
      .then((latest) => {
        if (current !== generation.current) return;
        setBaseline(latest);
        setName(latest.name);
        setAddress(latest.address);
        setLogoUrl(latest.logoUrl);
      })
      .catch(() => {
        if (current === generation.current) setLoadError(true);
      })
      .finally(() => {
        if (current !== generation.current) return;
        lock.current = false;
        setLoading(false);
      });
    return () => {
      generation.current += 1;
    };
  }, [fetchLatest]);

  useEffect(() => {
    if (!loading && !loadError) nameRef.current?.focus();
  }, [loading, loadError]);

  function complete(store: Store) {
    pendingPatch.current = null;
    setPending(false);
    setBaseline(store);
    setName(store.name);
    setAddress(store.address);
    setLogoUrl(store.logoUrl);
    onSaved(store);
    toast.success("店铺已更新");
    onOpenChange(false);
  }

  async function reconcile(patch: UpdateStorePatch, current: number) {
    try {
      const latest = await fetchLatest();
      if (current !== generation.current) return;
      if (
        (Object.keys(patch) as Array<keyof UpdateStorePatch>).every(
          (key) => latest[key] === patch[key],
        )
      ) {
        complete(latest);
      } else {
        setBaseline(latest);
        if (patch.name === undefined) setName(latest.name);
        if (patch.address === undefined) setAddress(latest.address);
        if (patch.logoUrl === undefined) setLogoUrl(latest.logoUrl);
        pendingPatch.current = null;
        setPending(false);
        setError("已核实店铺最新资料，修改尚未确认保存。请核对输入后重新保存");
      }
    } catch {
      if (current === generation.current)
        setError("暂时无法核实保存结果，请重新核实后再继续");
    }
  }

  async function retryReconcile() {
    if (lock.current || !pendingPatch.current) return;
    lock.current = true;
    const current = generation.current;
    setSaving(true);
    await reconcile(pendingPatch.current, current);
    if (current === generation.current) {
      lock.current = false;
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || pendingPatch.current || !baseline) return;
    setSubmitted(true);
    if (!validation.ok) {
      if (validation.errors.name) nameRef.current?.focus();
      else addressRef.current?.focus();
      return;
    }
    const patch: UpdateStorePatch = {};
    if (validation.fields.name !== baseline.name)
      patch.name = validation.fields.name;
    if (validation.fields.address !== baseline.address)
      patch.address = validation.fields.address;
    if (logoUrl !== baseline.logoUrl) patch.logoUrl = logoUrl;
    if (!Object.keys(patch).length) return;
    lock.current = true;
    const current = generation.current;
    setSaving(true);
    setError(null);
    try {
      const saved = await updateStore({ id: storeId, patch }, options);
      if (current === generation.current) complete(saved);
    } catch (caught) {
      if (current !== generation.current) return;
      if (caught instanceof ValidationError) setError(caught.message);
      else {
        pendingPatch.current = patch;
        setPending(true);
        await reconcile(patch, current);
      }
    } finally {
      if (current === generation.current) {
        lock.current = false;
        setSaving(false);
      }
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || lock.current || pendingPatch.current) return;
    lock.current = true;
    const current = generation.current;
    setUploading(true);
    setLogoError(null);
    try {
      const uploaded = await uploadProductImage(file);
      if (current === generation.current) setLogoUrl(uploaded);
    } catch (caught) {
      if (current === generation.current)
        setLogoError(
          caught instanceof Error ? caught.message : "图片上传失败，请重试",
        );
    } finally {
      if (current === generation.current) {
        lock.current = false;
        setUploading(false);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!lock.current && !pendingPatch.current) onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={!disabled}
        onOpenAutoFocus={() => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (lock.current || pendingPatch.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (lock.current || pendingPatch.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b p-6 pr-12">
          <DialogTitle>编辑店铺</DialogTitle>
          <DialogDescription className="sr-only">
            修改店铺名称、地址和 Logo
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div
            role="status"
            aria-label="正在加载店铺资料"
            className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-6"
          >
            <FieldGroup
              className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]"
              aria-hidden="true"
            >
              <Field className="sm:row-span-2">
                <Skeleton className="h-5 w-20" />
                <div className="flex flex-col items-start gap-3">
                  <Skeleton className="size-16 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Skeleton className="h-11 w-28" />
                    <Skeleton className="size-11" />
                  </div>
                </div>
              </Field>
              <Field>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-11 w-full" />
              </Field>
              <Field>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-24 w-full" />
              </Field>
            </FieldGroup>
          </div>
        ) : loadError ? (
          <div className="p-6">
            <LoadFailure
              variant="compact"
              title="店铺资料加载失败"
              onRetry={() => void load()}
            />
          </div>
        ) : baseline ? (
          <form
            id="desktop-store-edit-form"
            className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-6"
            noValidate
            onSubmit={handleSubmit}
          >
            <FieldGroup className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <Field
                className="sm:row-span-2"
                data-invalid={Boolean(logoError)}
              >
                <FieldLabel>店铺 Logo</FieldLabel>
                <div className="flex flex-col items-start gap-3">
                  <Avatar className="size-24 rounded-lg border">
                    <AvatarImage src={logoUrl} alt="店铺 Logo 预览" />
                    <AvatarFallback className="rounded-lg">
                      <RiStore2Line className="size-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div
                    role="group"
                    aria-label="店铺 Logo 操作"
                    className="flex min-w-0 flex-wrap items-center gap-2"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="default"
                      disabled={disabled}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <RiUpload2Line data-icon="inline-start" />
                      )}
                      {logoUrl ? "更改" : "上传 Logo"}
                    </Button>
                    {logoUrl ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label="移除店铺 Logo"
                        title="移除 Logo"
                        disabled={disabled}
                        onClick={() => {
                          setLogoUrl("");
                          setLogoError(null);
                        }}
                      >
                        <RiDeleteBinLine aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={disabled}
                    onChange={handleLogoChange}
                  />
                </div>
                <FieldError>{logoError}</FieldError>
              </Field>
              <Field data-invalid={Boolean(fieldErrors.name)}>
                <FieldLabel htmlFor="desktop-edit-store-name">
                  店铺名称
                </FieldLabel>
                <Input
                  ref={nameRef}
                  id="desktop-edit-store-name"
                  value={name}
                  maxLength={100}
                  autoComplete="organization"
                  disabled={disabled}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={
                    fieldErrors.name
                      ? "desktop-edit-store-name-error"
                      : undefined
                  }
                  onChange={(event) => setName(event.target.value)}
                />
                <FieldError id="desktop-edit-store-name-error">
                  {fieldErrors.name ? "请输入店铺名称" : null}
                </FieldError>
              </Field>
              <Field data-invalid={Boolean(fieldErrors.address)}>
                <FieldLabel htmlFor="desktop-edit-store-address">
                  店铺地址
                </FieldLabel>
                <Textarea
                  ref={addressRef}
                  id="desktop-edit-store-address"
                  value={address}
                  maxLength={200}
                  rows={3}
                  autoComplete="street-address"
                  disabled={disabled}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={
                    fieldErrors.address
                      ? "desktop-edit-store-address-error"
                      : undefined
                  }
                  onChange={(event) => setAddress(event.target.value)}
                />
                <FieldError id="desktop-edit-store-address-error">
                  {fieldErrors.address ? "请输入店铺地址" : null}
                </FieldError>
              </Field>
              {error ? (
                <Alert className="sm:col-span-2" variant="destructive">
                  <AlertTitle>
                    {pending ? "保存结果待核实" : "店铺保存失败"}
                  </AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </form>
        ) : null}
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          {pending ? (
            <Button
              type="button"
              disabled={saving}
              onClick={() => void retryReconcile()}
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? "正在核实" : "重新核实"}
            </Button>
          ) : (
            <Button
              type="submit"
              form="desktop-store-edit-form"
              disabled={disabled || !dirty}
            >
              <RiCheckboxCircleLine data-icon="inline-start" />
              {saving ? "正在保存" : "保存修改"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
