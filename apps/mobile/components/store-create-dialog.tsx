"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiStore2Line,
  RiUpload2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createStore,
  ValidationError,
  type DataSource,
  type ServiceOptions,
} from "@sast-shop/api";
import {
  resolveStoreCreateReturnPath,
  validateStoreCreateFields,
} from "@sast-shop/domain";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";

import { uploadProductImage } from "@/lib/product-image-upload";

const STORE_THEME_COLOR = "#c9431f";

export function StoreCreateDialog({
  children,
  open: controlledOpen,
  onOpenChange,
  dataSource,
  connectBaseUrl,
  returnTo,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  dataSource: DataSource;
  connectBaseUrl: string;
  returnTo: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLTextAreaElement>(null);
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldValidation = validateStoreCreateFields({ name, address });
  const fieldErrors =
    hasSubmitted && !fieldValidation.ok ? fieldValidation.errors : {};

  function resetForm() {
    setName("");
    setAddress("");
    setLogoUrl("");
    setHasSubmitted(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submitting || uploading) return;
    if (!nextOpen) resetForm();
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function closeAfterSuccess() {
    resetForm();
    if (controlledOpen === undefined) setInternalOpen(false);
    onOpenChange?.(false);
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      setLogoUrl(await uploadProductImage(file));
      toast.success("店铺 Logo 已上传");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || uploading) return;

    setHasSubmitted(true);
    if (!fieldValidation.ok) {
      if (fieldValidation.errors.name) nameInputRef.current?.focus();
      else addressInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const store = await createStore(
        {
          ...fieldValidation.fields,
          logoUrl,
          themeColor: STORE_THEME_COLOR,
        },
        serviceOptions,
      );
      toast.success("店铺已创建");
      closeAfterSuccess();
      const nextPath = resolveStoreCreateReturnPath(
        returnTo,
        store.id,
        window.location.origin,
      );
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) {
        window.setTimeout(() => router.refresh(), 240);
      } else if (
        new URL(nextPath, window.location.origin).pathname ===
        window.location.pathname
      ) {
        window.setTimeout(() => router.replace(nextPath), 240);
      } else {
        window.setTimeout(() => router.push(nextPath), 240);
      }
    } catch (caught) {
      setError(
        caught instanceof ValidationError
          ? caught.message
          : "创建失败，请稍后再试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      {children ? <DrawerTrigger asChild>{children}</DrawerTrigger> : null}
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle>创建店铺</DrawerTitle>
          <DrawerDescription className="sr-only">
            填写并保存店铺资料
          </DrawerDescription>
        </DrawerHeader>

        <form
          id="mobile-store-create-dialog-form"
          className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2"
          noValidate
          onSubmit={handleSubmit}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>店铺 Logo</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16 rounded-lg border">
                  <AvatarImage src={logoUrl} alt="店铺 Logo 预览" />
                  <AvatarFallback className="rounded-lg">
                    <RiStore2Line className="size-6" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RiUpload2Line data-icon="inline-start" />
                  )}
                  {logoUrl ? "更换 Logo" : "上传 Logo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.name)}>
              <FieldLabel htmlFor="mobile-dialog-store-name">
                店铺名称
              </FieldLabel>
              <Input
                ref={nameInputRef}
                id="mobile-dialog-store-name"
                value={name}
                maxLength={100}
                autoComplete="organization"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-errormessage={
                  fieldErrors.name
                    ? "mobile-dialog-store-name-error"
                    : undefined
                }
                onChange={(event) => setName(event.target.value)}
              />
              <FieldError id="mobile-dialog-store-name-error">
                {fieldErrors.name ? "请输入店铺名称" : null}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.address)}>
              <FieldLabel htmlFor="mobile-dialog-store-address">
                店铺地址
              </FieldLabel>
              <Textarea
                ref={addressInputRef}
                id="mobile-dialog-store-address"
                value={address}
                maxLength={200}
                rows={3}
                autoComplete="street-address"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.address)}
                aria-errormessage={
                  fieldErrors.address
                    ? "mobile-dialog-store-address-error"
                    : undefined
                }
                onChange={(event) => setAddress(event.target.value)}
              />
              <FieldError id="mobile-dialog-store-address-error">
                {fieldErrors.address ? "请输入店铺地址" : null}
              </FieldError>
            </Field>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>店铺创建失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </form>

        <DrawerFooter className="shrink-0 border-t bg-card">
          <Button
            type="submit"
            form="mobile-store-create-dialog-form"
            size="lg"
            disabled={submitting || uploading}
          >
            {submitting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RiCheckboxCircleLine data-icon="inline-start" />
            )}
            {submitting ? "正在创建" : "创建店铺"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
