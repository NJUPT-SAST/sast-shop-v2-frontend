"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiAddLine,
  RiBarcodeLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFileList3Line,
  RiImageAddLine,
  RiImageLine,
  RiQrScan2Line,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  configureLarkJsapi,
  createProductTemplate,
  deleteProductTemplate,
  isLarkScanCancelledError,
  listProductTemplatesPage,
  scanLarkBarcode,
  updateProductTemplate,
  type DataSource,
  type ProductTemplate,
  type PageResult,
  type ServiceOptions,
  type Store,
  ValidationError,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import { ManagedImage } from "@/components/managed-image";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { isJsapiAuthConfig } from "@/lib/jsapi-config";
import { uploadProductImage } from "@/lib/product-image-upload";

const templateSchema = z.object({
  storeId: z.string().min(1, "请选择店铺"),
  barcode: z
    .string()
    .trim()
    .min(1, "请输入商品条码")
    .max(64, "商品条码不能超过 64 位")
    .regex(/^\d+$/, "商品条码只能包含数字"),
  title: z.string().trim().min(1, "请输入商品名称").max(100),
  description: z.string().trim().max(500, "商品规格不能超过 500 字"),
  price: z.coerce
    .number<number>()
    .min(0.01, "参考价至少为 0.01 元")
    .max(21474836.47, "参考价过高")
    .multipleOf(0.01, "参考价最多保留两位小数"),
  mainImageUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || (value.length <= 2048 && /^https:\/\//.test(value)),
      "图片地址需要使用 HTTPS，且不能超过 2048 字符",
    ),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

type ProductTemplateManagerProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  stores: Store[];
  initialPage: PageResult<ProductTemplate>;
  selectedStoreId: string | null;
  prefillBarcode: string;
  startCreating: boolean;
  error: string | null;
};

export function ProductTemplateManager({
  dataSource,
  connectBaseUrl,
  stores,
  initialPage,
  selectedStoreId,
  prefillBarcode,
  startCreating,
  error,
}: ProductTemplateManagerProps) {
  const router = useRouter();
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl };
  const loadPage = useCallback(
    (page: number) => {
      if (!selectedStoreId) return Promise.resolve(initialPage);
      return listProductTemplatesPage({
        dataSource,
        connectBaseUrl,
        storeId: selectedStoreId,
        page,
        pageSize: initialPage.pageSize,
      });
    },
    [connectBaseUrl, dataSource, initialPage, selectedStoreId],
  );
  const {
    items: templates,
    setItems: setTemplates,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount,
    loadMore,
  } = useInfinitePage({
    initialPage,
    loadPage,
    getKey: getTemplateKey,
    identity: `${dataSource}:${connectBaseUrl}:${selectedStoreId ?? "none"}`,
  });
  const [keyword, setKeyword] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<ProductTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(
    startCreating && Boolean(selectedStoreId),
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageUploadingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const scanningBarcodeRef = useRef(false);
  const showFeishuEntry = useFeishuUiEnvironment();
  const createStoreReturnTo = buildCreateStoreReturnTo(
    prefillBarcode,
    startCreating,
  );
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: createDefaultValues(selectedStoreId, prefillBarcode),
  });
  const handleImageUploadingChange = useCallback((uploading: boolean) => {
    imageUploadingRef.current = uploading;
    setImageUploading(uploading);
  }, []);

  const visibleTemplates = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return templates;

    return templates.filter((template) =>
      [template.title, template.description, template.barcode].some((field) =>
        field.toLowerCase().includes(value),
      ),
    );
  }, [keyword, templates]);

  useEffect(() => {
    if (!keyword.trim() || !hasMore || loadMoreError) return;
    const timeout = window.setTimeout(() => void loadMore(), 250);
    return () => window.clearTimeout(timeout);
  }, [hasMore, keyword, loadMore, loadMoreError]);

  function openCreateDrawer() {
    setSaveError(null);
    setDeleteError(null);
    setEditingTemplate(null);
    form.reset(createDefaultValues(selectedStoreId, prefillBarcode));
    setDrawerOpen(true);
  }

  function openEditDrawer(template: ProductTemplate) {
    setSaveError(null);
    setDeleteError(null);
    setEditingTemplate(template);
    form.reset({
      storeId: template.storeId,
      barcode: template.barcode,
      title: template.title,
      description: template.description,
      price: template.priceCents / 100,
      mainImageUrl: template.mainImageUrl,
    });
    setDrawerOpen(true);
  }

  async function scanTemplateBarcode() {
    if (scanningBarcodeRef.current) return;
    if (!window.h5sdk || !window.tt) {
      toast.message("请在飞书移动端内扫码");
      return;
    }

    scanningBarcodeRef.current = true;
    setScanningBarcode(true);
    try {
      const signingUrl = window.location.href.split("#", 1)[0] ?? "";
      const response = await fetch(
        `/api/auth/jsapi-config?url=${encodeURIComponent(signingUrl)}`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isJsapiAuthConfig(body)) {
        throw new Error(
          response.status === 401
            ? "登录已失效，请重新打开应用"
            : "扫码鉴权暂不可用，请稍后再试",
        );
      }

      await configureLarkJsapi(window.h5sdk, body);
      const barcode = await scanLarkBarcode(window.tt);
      form.setValue("barcode", barcode, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      toast.success("已识别商品条码");
    } catch (reason) {
      if (isLarkScanCancelledError(reason)) return;
      toast.error(
        reason instanceof Error ? reason.message : "扫码失败，请手动输入条码",
      );
    } finally {
      scanningBarcodeRef.current = false;
      setScanningBarcode(false);
    }
  }

  async function saveTemplate(values: TemplateFormValues) {
    if (submittingRef.current || imageUploadingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);

    try {
      const payload = {
        storeId: values.storeId,
        barcode: values.barcode,
        title: values.title,
        description: values.description,
        priceCents: Math.round(values.price * 100),
        mainImageUrl: values.mainImageUrl,
      };
      const saved = editingTemplate
        ? await updateExistingTemplate(editingTemplate, payload, serviceOptions)
        : await createProductTemplate(payload, serviceOptions);

      if (saved.storeId === selectedStoreId) {
        setTemplates((current) => upsertTemplate(current, saved));
      } else {
        setTemplates((current) =>
          current.filter((template) => template.id !== saved.id),
        );
      }
      setDrawerOpen(false);
      setEditingTemplate(null);
      toast.success(editingTemplate ? "商品模板已更新" : "商品模板已创建");
      router.refresh();
    } catch (caught) {
      setSaveError(readErrorMessage(caught));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function deleteTemplate() {
    if (!editingTemplate || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProductTemplate({ id: editingTemplate.id }, serviceOptions);
      setTemplates((current) =>
        current.filter((template) => template.id !== editingTemplate.id),
      );
      setDeleteConfirmOpen(false);
      setDrawerOpen(false);
      setEditingTemplate(null);
      toast.success("商品模板已删除");
      router.refresh();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "商品模板删除失败",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 pb-4 pt-6">
      <section className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold leading-7 md:text-2xl">
          商品模板
        </h1>
        {stores.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            <StoreCreateDialog
              dataSource={dataSource}
              connectBaseUrl={connectBaseUrl}
              returnTo={createStoreReturnTo}
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
              >
                创建店铺
              </Button>
            </StoreCreateDialog>
            {selectedStoreId ? (
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                onClick={openCreateDrawer}
              >
                <RiAddLine data-icon="inline-start" />
                新建模板
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? (
        <LoadFailure
          variant="compact"
          title="商品模板加载失败"
          description={error}
          onRetry={() => router.refresh()}
        />
      ) : null}

      {stores.length > 0 ? (
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="template-store">当前店铺</FieldLabel>
            <Select
              value={selectedStoreId ?? undefined}
              onValueChange={(value) => {
                setKeyword("");
                router.replace(
                  `/group/templates?store=${encodeURIComponent(value)}`,
                );
              }}
            >
              <SelectTrigger id="template-store" aria-label="当前店铺">
                <span className="truncate">
                  {stores.find((store) => store.id === selectedStoreId)?.name ??
                    "选择店铺"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="template-search">搜索模板</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiSearchLine />
              </InputGroupAddon>
              <InputGroupInput
                id="template-search"
                value={keyword}
                placeholder="搜索商品名称、规格或条码"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      ) : null}

      {visibleTemplates.length > 0 ? (
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-label="商品模板列表"
        >
          {visibleTemplates.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              onEdit={() => openEditDrawer(template)}
            />
          ))}
        </section>
      ) : !error && !loadingMore && !hasMore ? (
        <Empty
          icon={
            stores.length === 0 ? (
              <RiStore2Line className="size-5" />
            ) : (
              <RiFileList3Line className="size-5" />
            )
          }
          title={
            stores.length === 0
              ? "还没有店铺"
              : keyword
                ? "没有匹配的商品模板"
                : "暂无商品模板"
          }
          action={
            stores.length === 0 ? (
              <StoreCreateDialog
                dataSource={dataSource}
                connectBaseUrl={connectBaseUrl}
                returnTo={createStoreReturnTo}
              >
                <Button type="button">
                  <RiStore2Line data-icon="inline-start" />
                  创建店铺
                </Button>
              </StoreCreateDialog>
            ) : undefined
          }
        />
      ) : null}

      {!error && selectedStoreId ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<TemplateLoadingSkeletons />}
          endMessage={`已经到底，共 ${templates.length} 个商品模板`}
        />
      ) : null}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!submittingRef.current && !imageUploadingRef.current)
            setDrawerOpen(open);
        }}
      >
        <DrawerContent className="max-h-[88dvh] overflow-clip">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>
              {editingTemplate ? "编辑商品模板" : "新建商品模板"}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              填写并保存商品模板
            </DrawerDescription>
          </DrawerHeader>

          {editingTemplate && !editingTemplate.updatedAt ? (
            <p className="px-4 text-sm text-destructive">
              缺少模板版本，刷新页面后再编辑。
            </p>
          ) : null}

          <form
            id="product-template-form"
            className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2"
            noValidate
            onSubmit={(event) => void form.handleSubmit(saveTemplate)(event)}
          >
            <TemplateFields
              form={form}
              stores={stores}
              lockStore={Boolean(editingTemplate)}
              scanEnabled={showFeishuEntry}
              scanningBarcode={scanningBarcode}
              onScanBarcode={() => void scanTemplateBarcode()}
              onImageUploadingChange={handleImageUploadingChange}
            />
          </form>

          {saveError ? (
            <p role="alert" className="px-4 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DrawerFooter className="shrink-0 border-t bg-card">
            <div className="flex gap-3">
              {editingTemplate ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="min-h-11"
                  aria-label="删除商品模板"
                  disabled={submitting || imageUploading}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <RiDeleteBinLine />
                </Button>
              ) : null}
              <Button
                type="submit"
                form="product-template-form"
                size="lg"
                className="min-h-11 flex-1"
                disabled={
                  submitting ||
                  imageUploading ||
                  (Boolean(editingTemplate) && !editingTemplate?.updatedAt)
                }
              >
                {submitting
                  ? "保存中"
                  : imageUploading
                    ? "图片上传中"
                    : editingTemplate
                      ? "保存修改"
                      : "创建模板"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setDeleteError(null);
        }}
      >
        <DrawerContent className="overflow-clip">
          <DrawerHeader className="text-left">
            <DrawerTitle>删除商品模板？</DrawerTitle>
            <DrawerDescription>
              删除后无法恢复，已上架的现货不会受影响。
            </DrawerDescription>
          </DrawerHeader>
          {deleteError ? (
            <p role="alert" className="px-4 text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <DrawerFooter className="border-t bg-card">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="min-h-11"
              disabled={deleting}
              onClick={() => void deleteTemplate()}
            >
              {deleting ? <Spinner /> : null}
              删除
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function TemplateLoadingSkeletons() {
  return (
    <div className="flex flex-col gap-3" aria-label="正在加载更多商品模板">
      {Array.from({ length: 3 }, (_, index) => (
        <Item key={index} variant="outline" aria-hidden="true">
          <Skeleton className="size-14 shrink-0 rounded-lg" />
          <ItemContent className="gap-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-3/4" />
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}

function getTemplateKey(template: ProductTemplate) {
  return template.id;
}

function TemplateItem({
  template,
  onEdit,
}: {
  template: ProductTemplate;
  onEdit: () => void;
}) {
  return (
    <Item asChild variant="outline">
      <button
        type="button"
        className="min-w-0 cursor-pointer items-start hover:bg-muted/30"
        onClick={onEdit}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {template.mainImageUrl ? <RiImageLine /> : <RiBarcodeLine />}
        </span>
        <ItemContent className="min-w-0 gap-1.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <ItemTitle className="min-w-0 truncate leading-5">
              {template.title}
            </ItemTitle>
            <Badge variant="secondary" className="shrink-0">
              {formatPrice(template.priceCents)}
            </Badge>
          </div>
          {template.description ? (
            <ItemDescription className="line-clamp-2 break-words">
              {template.description}
            </ItemDescription>
          ) : null}
          {template.barcode ? (
            <ItemDescription className="flex items-center gap-1.5 truncate font-mono text-xs tabular-nums">
              <RiBarcodeLine className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{template.barcode}</span>
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions className="self-center">
          <RiEditLine className="size-4 text-muted-foreground" />
        </ItemActions>
      </button>
    </Item>
  );
}

function TemplateFields({
  form,
  stores,
  lockStore,
  scanEnabled,
  scanningBarcode,
  onScanBarcode,
  onImageUploadingChange,
}: {
  form: ReturnType<typeof useForm<TemplateFormValues>>;
  stores: Store[];
  lockStore: boolean;
  scanEnabled: boolean;
  scanningBarcode: boolean;
  onScanBarcode: () => void;
  onImageUploadingChange: (uploading: boolean) => void;
}) {
  return (
    <FieldGroup className="gap-5">
      <Controller
        name="storeId"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>店铺</FieldLabel>
            <Select
              value={field.value}
              disabled={lockStore}
              onValueChange={field.onChange}
            >
              <SelectTrigger
                id={field.name}
                aria-label="店铺"
                aria-invalid={fieldState.invalid}
              >
                <span className="truncate">
                  {stores.find((store) => store.id === field.value)?.name ??
                    "选择店铺"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {lockStore ? (
              <FieldDescription>
                编辑时不能更换店铺；请在目标店铺新建模板。
              </FieldDescription>
            ) : null}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="barcode"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>商品条码</FieldLabel>
            <InputGroup>
              <InputGroupInput
                {...field}
                id={field.name}
                inputMode="numeric"
                autoComplete="off"
                placeholder="输入条码编号"
                aria-invalid={fieldState.invalid}
              />
              {scanEnabled ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label="扫码填写商品条码"
                    title="扫码"
                    disabled={scanningBarcode}
                    onClick={onScanBarcode}
                  >
                    {scanningBarcode ? <Spinner /> : <RiQrScan2Line />}
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>商品名称</FieldLabel>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="description"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>规格说明</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              rows={3}
              placeholder="例如：550ml 瓶装"
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="price"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>参考原价</FieldLabel>
            <InputGroup>
              <InputGroupAddon>¥</InputGroupAddon>
              <InputGroupInput
                {...field}
                id={field.name}
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
              />
            </InputGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="mainImageUrl"
        control={form.control}
        render={({ field, fieldState }) => (
          <ProductImageField
            value={field.value}
            invalid={fieldState.invalid}
            error={fieldState.error}
            onChange={field.onChange}
            onUploadingChange={onImageUploadingChange}
          />
        )}
      />
    </FieldGroup>
  );
}

function ProductImageField({
  value,
  invalid,
  error,
  onChange,
  onUploadingChange,
}: {
  value: string;
  invalid: boolean;
  error: { message?: string } | undefined;
  onChange: (value: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    onUploadingChange(true);
    setUploadError(null);
    try {
      onChange(await uploadProductImage(file));
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "图片上传失败");
    } finally {
      setUploading(false);
      onUploadingChange(false);
      event.target.value = "";
    }
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="product-template-image">商品图片</FieldLabel>
      <div className="relative overflow-hidden rounded-lg border bg-muted/30">
        <button
          type="button"
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={value ? "更换商品图片" : "上传商品图片"}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {value ? (
            <ManagedImage
              src={value}
              alt="商品图片预览"
              className="absolute inset-0 size-full rounded-none transition-opacity duration-200 motion-reduce:transition-none"
            />
          ) : (
            <RiImageAddLine className="size-8 text-muted-foreground" />
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <Spinner className="size-6" />
            </span>
          ) : null}
        </button>

        {value && !uploading ? (
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              size="icon-touch"
              variant="secondary"
              className="shadow-sm"
              aria-label="更换商品图片"
              title="更换图片"
              onClick={() => inputRef.current?.click()}
            >
              <RiImageAddLine />
            </Button>
            <Button
              type="button"
              size="icon-touch"
              variant="destructive"
              className="shadow-sm"
              aria-label="移除商品图片"
              title="移除图片"
              onClick={() => onChange("")}
            >
              <RiDeleteBinLine />
            </Button>
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id="product-template-image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <FieldError errors={[error]} />
      {uploadError ? (
        <p role="alert" className="text-sm text-destructive">
          {uploadError}
        </p>
      ) : null}
    </Field>
  );
}

function createDefaultValues(
  storeId: string | null,
  barcode: string,
): TemplateFormValues {
  return {
    storeId: storeId ?? "",
    barcode,
    title: "",
    description: "",
    price: 0.01,
    mainImageUrl: "",
  };
}

async function updateExistingTemplate(
  template: ProductTemplate,
  patch: {
    barcode: string;
    title: string;
    description: string;
    priceCents: number;
    mainImageUrl: string;
  },
  options: ServiceOptions,
): Promise<ProductTemplate> {
  if (!template.updatedAt) {
    throw new Error("缺少模板版本，刷新页面后再试");
  }

  return updateProductTemplate(
    { id: template.id, updatedAt: template.updatedAt, patch },
    options,
  );
}

function upsertTemplate(
  templates: ProductTemplate[],
  saved: ProductTemplate,
): ProductTemplate[] {
  const index = templates.findIndex((template) => template.id === saved.id);
  if (index === -1) return [saved, ...templates];

  return templates.map((template) =>
    template.id === saved.id ? saved : template,
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ValidationError && error.message.trim()) {
    return error.message;
  }

  return "保存商品模板失败，请稍后再试";
}

function buildCreateStoreReturnTo(
  barcode: string,
  continueCreatingTemplate: boolean,
): string {
  const params = new URLSearchParams();
  if (continueCreatingTemplate) params.set("create", "1");
  if (barcode.trim()) params.set("barcode", barcode.trim());
  return params.size
    ? `/group/templates?${params.toString()}`
    : "/group/templates";
}
