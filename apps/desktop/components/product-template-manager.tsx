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
import {
  RiAddLine,
  RiBarcodeLine,
  RiDeleteBinLine,
  RiEditLine,
  RiImageAddLine,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createProductTemplate,
  deleteProductTemplate,
  listProductTemplatesPage,
  updateProductTemplate,
  ValidationError,
  type DataSource,
  type ProductTemplate,
  type PageResult,
  type ServiceOptions,
  type Store,
} from "@sast-shop/api";
import { formatPrice, parseYuanToCents } from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
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
import { uploadProductImage } from "@/lib/product-image-upload";

type TemplateDraft = {
  storeId: string;
  barcode: string;
  title: string;
  description: string;
  price: string;
  mainImageUrl: string;
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
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  stores: Store[];
  initialPage: PageResult<ProductTemplate>;
  selectedStoreId: string | null;
  prefillBarcode: string;
  startCreating: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [editing, setEditing] = useState<ProductTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<ProductTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(
    startCreating && Boolean(selectedStoreId),
  );
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    createDraft(selectedStoreId, prefillBarcode),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const createStoreReturnTo = buildCreateStoreReturnTo(
    prefillBarcode,
    startCreating,
  );

  const visibleTemplates = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) =>
      [template.title, template.description, template.barcode].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [keyword, templates]);

  useEffect(() => {
    if (!keyword.trim() || !hasMore || loadMoreError) return;
    const timeout = window.setTimeout(() => void loadMore(), 250);
    return () => window.clearTimeout(timeout);
  }, [hasMore, keyword, loadMore, loadMoreError]);

  function openCreate() {
    setEditing(null);
    setDraft(createDraft(selectedStoreId, prefillBarcode));
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(template: ProductTemplate) {
    setEditing(template);
    setDraft({
      storeId: template.storeId,
      barcode: template.barcode,
      title: template.title,
      description: template.description,
      price: (template.priceCents / 100).toFixed(2),
      mainImageUrl: template.mainImageUrl,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const mainImageUrl = await uploadProductImage(file);
      setDraft((current) => ({ ...current, mainImageUrl }));
      toast.success("商品图片已上传");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (submitting) return;
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        storeId: draft.storeId,
        barcode: draft.barcode.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        priceCents: validation.priceCents,
        mainImageUrl: draft.mainImageUrl,
      };
      const saved = editing
        ? await updateProductTemplate(
            {
              id: editing.id,
              updatedAt: requireUpdatedAt(editing),
              patch: payload,
            },
            serviceOptions,
          )
        : await createProductTemplate(payload, serviceOptions);

      setTemplates((current) => upsertTemplate(current, saved));
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "商品模板已更新" : "商品模板已创建");
      router.refresh();
    } catch (caught) {
      setFormError(readErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTemplate() {
    if (!deletingTemplate || deleting) return;
    setDeleting(true);
    try {
      await deleteProductTemplate(
        { id: deletingTemplate.id },
        serviceOptions,
      );
      setTemplates((current) =>
        current.filter((template) => template.id !== deletingTemplate.id),
      );
      setDeletingTemplate(null);
      toast.success("商品模板已删除");
      router.refresh();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "商品模板删除失败",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">商品模板</h1>
        <div className="flex items-center gap-2">
          <StoreCreateDialog
            dataSource={dataSource}
            connectBaseUrl={connectBaseUrl}
            returnTo={createStoreReturnTo}
          >
            <Button variant="outline">
              <RiStore2Line data-icon="inline-start" />
              创建店铺
            </Button>
          </StoreCreateDialog>
          {selectedStoreId ? (
            <Button type="button" onClick={openCreate}>
              <RiAddLine data-icon="inline-start" />
              新建模板
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <LoadFailure
          variant="compact"
          title="商品模板加载失败"
          description={error}
          onRetry={() => router.refresh()}
        />
      ) : null}

      {!error ? (
        <>
          {stores.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-[18rem_minmax(0,1fr)]">
              <Field>
                <FieldLabel htmlFor="desktop-template-store">店铺</FieldLabel>
                <Select
                  value={selectedStoreId ?? undefined}
                  onValueChange={(value) => {
                    setKeyword("");
                    router.replace(
                      `/group/templates?store=${encodeURIComponent(value)}`,
                    );
                  }}
                >
                  <SelectTrigger id="desktop-template-store">
                    <span className="truncate">
                      {stores.find((store) => store.id === selectedStoreId)
                        ?.name ?? "选择店铺"}
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
                <FieldLabel htmlFor="desktop-template-search">搜索</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiSearchLine />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="desktop-template-search"
                    value={keyword}
                    placeholder="商品名称、规格或条码"
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                </InputGroup>
              </Field>
            </div>
          ) : null}

          {selectedStoreId && visibleTemplates.length > 0 ? (
            <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {visibleTemplates.map((template) => (
                <Card key={template.id} className="overflow-hidden">
                  <CardContent className="flex min-w-0 gap-4 p-4">
                    <ManagedImage
                      src={template.mainImageUrl}
                      alt={template.title}
                      className="size-20 shrink-0 rounded-lg border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold">
                            {template.title}
                          </h2>
                          {template.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`编辑${template.title}`}
                          onClick={() => openEdit(template)}
                        >
                          <RiEditLine />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`删除${template.title}`}
                          onClick={() => setDeletingTemplate(template)}
                        >
                          <RiDeleteBinLine />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-primary">
                          {formatPrice(template.priceCents)}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {template.barcode}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : !loadingMore && !hasMore ? (
            <Empty
              icon={
                selectedStoreId ? (
                  <RiBarcodeLine className="size-5" />
                ) : (
                  <RiStore2Line className="size-5" />
                )
              }
              title={
                !selectedStoreId
                  ? "还没有店铺"
                  : keyword
                    ? "没有匹配的商品模板"
                    : "暂无商品模板"
              }
              action={
                !selectedStoreId ? (
                  <StoreCreateDialog
                    dataSource={dataSource}
                    connectBaseUrl={connectBaseUrl}
                    returnTo={createStoreReturnTo}
                  >
                    <Button>
                      <RiStore2Line data-icon="inline-start" />
                      创建店铺
                    </Button>
                  </StoreCreateDialog>
                ) : !keyword ? (
                  <Button type="button" variant="outline" onClick={openCreate}>
                    <RiAddLine data-icon="inline-start" />
                    新建模板
                  </Button>
                ) : undefined
              }
            />
          ) : null}

          {selectedStoreId ? (
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
        </>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑商品模板" : "新建商品模板"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              填写商品模板资料
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[65vh] gap-5 overflow-y-auto pr-1 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="template-form-store">店铺</FieldLabel>
              <Select
                value={draft.storeId}
                disabled={Boolean(editing)}
                onValueChange={(storeId) =>
                  setDraft((current) => ({ ...current, storeId }))
                }
              >
                <SelectTrigger id="template-form-store">
                  <span className="truncate">
                    {stores.find((store) => store.id === draft.storeId)?.name ??
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
              <FieldLabel htmlFor="template-form-barcode">商品条码</FieldLabel>
              <Input
                id="template-form-barcode"
                value={draft.barcode}
                inputMode="numeric"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    barcode: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="template-form-title">商品名称</FieldLabel>
              <Input
                id="template-form-title"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="template-form-price">参考价</FieldLabel>
              <Input
                id="template-form-price"
                type="number"
                min="0.01"
                max="21474836.47"
                step="0.01"
                value={draft.price}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="template-form-description">
                商品规格
              </FieldLabel>
              <Textarea
                id="template-form-description"
                rows={3}
                maxLength={500}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel>商品图片</FieldLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleImage(event)}
              />
              <button
                type="button"
                className="flex min-h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Spinner />
                ) : draft.mainImageUrl ? (
                  <ManagedImage
                    src={draft.mainImageUrl}
                    alt="商品图片预览"
                    className="h-40 w-full"
                  />
                ) : (
                  <RiImageAddLine className="size-7 text-muted-foreground" />
                )}
              </button>
            </Field>
            {formError ? (
              <FieldError className="sm:col-span-2">{formError}</FieldError>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={submitting || uploading}
              onClick={() => void save()}
            >
              {submitting ? <Spinner /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingTemplate)}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除商品模板？</DialogTitle>
            <DialogDescription>
              删除后无法恢复，已上架的现货不会受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTemplate(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeTemplate()}
            >
              {deleting ? <Spinner /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateLoadingSkeletons() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3"
      aria-label="正在加载更多商品模板"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardContent className="flex gap-4 p-4">
            <Skeleton className="size-20 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getTemplateKey(template: ProductTemplate) {
  return template.id;
}

function createDraft(storeId: string | null, barcode: string): TemplateDraft {
  return {
    storeId: storeId ?? "",
    barcode,
    title: "",
    description: "",
    price: "0.01",
    mainImageUrl: "",
  };
}

function validateDraft(
  draft: TemplateDraft,
): { ok: true; priceCents: number } | { ok: false; message: string } {
  if (!draft.storeId) return { ok: false, message: "请选择店铺" };
  if (!/^\d{1,64}$/.test(draft.barcode.trim())) {
    return { ok: false, message: "商品条码应为 1 至 64 位数字" };
  }
  if (!draft.title.trim()) return { ok: false, message: "请输入商品名称" };
  if (draft.title.trim().length > 100) {
    return { ok: false, message: "商品名称不能超过 100 字" };
  }
  if (draft.description.trim().length > 500) {
    return { ok: false, message: "商品规格不能超过 500 字" };
  }
  const priceCents = parseYuanToCents(draft.price);
  if (priceCents === null || priceCents < 1) {
    return { ok: false, message: "参考价至少为 0.01 元" };
  }
  return { ok: true, priceCents };
}

function requireUpdatedAt(template: ProductTemplate): string {
  if (!template.updatedAt)
    throw new ValidationError("模板版本无效，请刷新页面");
  return template.updatedAt;
}

function upsertTemplate(
  templates: ProductTemplate[],
  saved: ProductTemplate,
): ProductTemplate[] {
  const exists = templates.some((template) => template.id === saved.id);
  return exists
    ? templates.map((template) => (template.id === saved.id ? saved : template))
    : [saved, ...templates];
}

function readErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "商品模板保存失败";
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
