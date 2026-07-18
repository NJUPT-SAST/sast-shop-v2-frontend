"use client";

import {
  type ChangeEvent,
  type FormEvent,
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
import { resolveStoreCreateReturnPath } from "@sast-shop/domain";
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
import { Card, CardContent } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";

import { uploadProductImage } from "@/lib/product-image-upload";

const STORE_THEME_COLOR = "#c9431f";

export function StoreCreateForm({
  dataSource,
  connectBaseUrl,
  returnTo,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || uploading) return;

    setSubmitting(true);
    setError(null);
    try {
      const store = await createStore(
        { name, address, logoUrl, themeColor: STORE_THEME_COLOR },
        serviceOptions,
      );
      toast.success("店铺已创建");
      router.replace(
        resolveStoreCreateReturnPath(
          returnTo,
          store.id,
          window.location.origin,
        ),
      );
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
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold md:text-2xl">创建店铺</h1>

      <form className="flex flex-1 flex-col gap-6" onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-4">
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

              <Field>
                <FieldLabel htmlFor="store-name">店铺名称</FieldLabel>
                <Input
                  id="store-name"
                  value={name}
                  maxLength={100}
                  autoComplete="organization"
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="store-address">店铺地址</FieldLabel>
                <Textarea
                  id="store-address"
                  value={address}
                  maxLength={200}
                  rows={3}
                  autoComplete="street-address"
                  required
                  onChange={(event) => setAddress(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>店铺创建失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="mt-auto mb-[calc(0.5rem+env(safe-area-inset-bottom))] w-full"
          disabled={submitting || uploading}
        >
          {submitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiCheckboxCircleLine data-icon="inline-start" />
          )}
          {submitting ? "正在创建" : "创建店铺"}
        </Button>
      </form>
    </div>
  );
}
