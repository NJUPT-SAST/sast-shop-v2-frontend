"use client";

import {
  type ChangeEvent,
  type MouseEvent,
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
  RiImageAddLine,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createProductTemplate,
  createProductCategory,
  deleteProductCategory,
  deleteProductTemplate,
  getProductTemplate,
  listProductTemplatesPage,
  listProductCategories,
  updateProductTemplate,
  ValidationError,
  type DataSource,
  type ProductTemplate,
  type ProductCategory,
  type PageResult,
  type ServiceOptions,
  type Store,
} from "@sast-shop/api";
import { formatPrice, parseYuanToCents } from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
import { EditActionLabel } from "@workspace/ui/components/edit-action-label";
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
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";

import { ManagedImage } from "@/components/managed-image";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { uploadProductImage } from "@/lib/product-image-upload";
import {
  rememberTemplateStoreId,
  resolveTemplateStoreId,
} from "@/lib/template-store-preference";

type TemplateDraft = {
  storeId: string;
  categoryId: string;
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
  requestedStoreId,
  requestedTemplateId,
  prefillBarcode,
  startCreating,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  stores: Store[];
  initialPage: PageResult<ProductTemplate>;
  selectedStoreId: string | null;
  requestedStoreId?: string;
  requestedTemplateId?: string;
  prefillBarcode: string;
  startCreating: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const mounted = useRef(true);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const editGeneration = useRef(0);
  const consumedEdit = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const uploadingRef = useRef(false);
  const deletingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const query = keyword.trim();
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedKeyword(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);
  const [listSelection, setListSelection] = useState<{
    storeId: string;
    value: string;
  } | null>(null);
  const listFilter =
    listSelection?.storeId === selectedStoreId
      ? (listSelection?.value ?? "all")
      : "all";
  const filterOptions = useMemo(() => {
    if (listFilter === "all") return {};
    if (listFilter === "uncategorized")
      return { categoryFilterMode: "uncategorized" as const };
    return { categoryFilterMode: "category" as const, categoryId: listFilter };
  }, [listFilter]);
  const listCategories = useCachedResource({
    cacheKey: JSON.stringify([
      "desktop:template-list-categories",
      dataSource,
      connectBaseUrl,
      selectedStoreId,
    ]),
    staleTime: 30_000,
    load: () =>
      selectedStoreId
        ? listProductCategories(selectedStoreId, serviceOptions)
        : Promise.resolve({ categories: [], hasUncategorizedProducts: false }),
  });
  const listCategoryOptions = listCategories.data?.categories ?? [];
  const listCategoryLabel = (category: ProductCategory) =>
    category.parentId
      ? (listCategoryOptions.find((parent) => parent.id === category.parentId)
          ?.name ?? "") +
        " / " +
        category.name
      : category.name;
  const hasListQuery = Boolean(debouncedKeyword || listFilter !== "all");
  const search = useCachedResource({
    cacheKey: JSON.stringify([
      "desktop:template-search",
      dataSource,
      connectBaseUrl,
      selectedStoreId,
      initialPage.pageSize,
      debouncedKeyword,
      listFilter,
    ]),
    staleTime: 30_000,
    refreshKey: initialPage,
    load: () =>
      hasListQuery && selectedStoreId
        ? listProductTemplatesPage({
            dataSource,
            connectBaseUrl,
            storeId: selectedStoreId,
            ...filterOptions,
            page: 1,
            pageSize: initialPage.pageSize,
            keyword: debouncedKeyword,
          })
        : Promise.resolve(initialPage),
  });
  const searching =
    query !== debouncedKeyword ||
    (hasListQuery && !search.data && !search.error);
  const searchError =
    query === debouncedKeyword && hasListQuery && search.error
      ? "搜索暂不可用，请稍后重试"
      : null;
  const firstPage = useMemo(
    () =>
      searching
        ? {
            items: [],
            currentPage: 1,
            pageSize: initialPage.pageSize,
            totalCount: 0,
            hasMore: false,
          }
        : hasListQuery
          ? (search.data ?? initialPage)
          : initialPage,
    [initialPage, hasListQuery, search.data, searching],
  );
  const loadPage = useCallback(
    (page: number) => {
      if (!selectedStoreId) return Promise.resolve(initialPage);
      return listProductTemplatesPage({
        dataSource,
        connectBaseUrl,
        storeId: selectedStoreId,
        ...filterOptions,
        page,
        pageSize: initialPage.pageSize,
        keyword: debouncedKeyword,
      });
    },
    [
      connectBaseUrl,
      dataSource,
      initialPage,
      selectedStoreId,
      debouncedKeyword,
      filterOptions,
    ],
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
    initialPage: firstPage,
    loadPage,
    getKey: getTemplateKey,
    identity: JSON.stringify([
      dataSource,
      connectBaseUrl,
      selectedStoreId,
      query,
      listFilter,
    ]),
  });
  const [editing, setEditing] = useState<ProductTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<ProductTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(
    Boolean(requestedTemplateId) || (startCreating && Boolean(selectedStoreId)),
  );
  const [requestedEditId, setRequestedEditId] = useState<string | null>(
    requestedTemplateId ?? null,
  );
  const [editLoadStatus, setEditLoadStatus] = useState<
    "idle" | "loading" | "error"
  >(requestedTemplateId ? "loading" : "idle");
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    createDraft(selectedStoreId, prefillBarcode),
  );
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryRootId, setCategoryRootId] = useState("");
  const [categoryCreateParentId, setCategoryCreateParentId] = useState<
    string | null | undefined
  >(undefined);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const createStoreReturnTo = buildCreateStoreReturnTo(
    prefillBarcode,
    startCreating,
  );
  useEffect(() => {
    if (!dialogOpen || !draft.storeId) return;
    let active = true;
    void listProductCategories(draft.storeId, serviceOptions)
      .then((result) => {
        if (!active) return;
        setCategories(result.categories);
        const saved = result.categories.find(
          (item) => item.id === editing?.categoryId,
        );
        const roots = result.categories.filter(
          (item) => item.parentId === null,
        );
        const first = roots.length === 1 ? roots[0] : undefined;
        setCategoryRootId(saved?.parentId ?? saved?.id ?? first?.id ?? "");
        if (
          !editing &&
          first &&
          !result.categories.some((item) => item.parentId === first.id)
        ) {
          setDraft((current) =>
            current.categoryId ? current : { ...current, categoryId: first.id },
          );
        }
      })
      .catch(() => {
        if (active) toast.error("分类加载失败，请稍后重试");
      });
    return () => {
      active = false;
    };
  }, [dialogOpen, draft.storeId, editing, serviceOptions]);

  const loadTemplate = useCallback(
    async (id: string) => {
      const generation = ++editGeneration.current;
      setRequestedEditId(id);
      setEditLoadStatus("loading");
      setEditing(null);
      setFormError(null);
      setDialogOpen(true);
      try {
        const template = await getProductTemplate(id, serviceOptions);
        if (!mounted.current || generation !== editGeneration.current) return;
        if (template.id !== id) throw new Error("商品模板身份已变化");
        setEditing(template);
        setDraft({
          storeId: template.storeId,
          categoryId: template.categoryId ?? "",
          barcode: template.barcode,
          title: template.title,
          description: template.description,
          price: (template.priceCents / 100).toFixed(2),
          mainImageUrl: template.mainImageUrl,
        });
        setEditLoadStatus("idle");
      } catch {
        if (mounted.current && generation === editGeneration.current)
          setEditLoadStatus("error");
      }
    },
    [serviceOptions],
  );

  useEffect(() => {
    if (!requestedTemplateId) {
      if (consumedEdit.current !== null) {
        consumedEdit.current = null;
        editGeneration.current += 1;
        setDialogOpen(false);
        setRequestedEditId(null);
        setEditing(null);
        setEditLoadStatus("idle");
      }
      return;
    }
    const request = JSON.stringify([
      dataSource,
      connectBaseUrl,
      requestedTemplateId,
    ]);
    if (consumedEdit.current === request) return;
    consumedEdit.current = request;
    dialogOpenerRef.current = null;
    void loadTemplate(requestedTemplateId);
  }, [connectBaseUrl, dataSource, loadTemplate, requestedTemplateId]);

  useEffect(() => {
    if (dialogOpen && editLoadStatus === "idle")
      barcodeInputRef.current?.focus();
  }, [dialogOpen, editLoadStatus]);

  function closeDialog() {
    if (submittingRef.current || uploadingRef.current) return;
    editGeneration.current += 1;
    setDialogOpen(false);
    setRequestedEditId(null);
    setEditLoadStatus("idle");
  }

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    if (submittingRef.current || uploadingRef.current) return;
    dialogOpenerRef.current = event.currentTarget;
    editGeneration.current += 1;
    setRequestedEditId(null);
    setEditLoadStatus("idle");
    setEditing(null);
    setDraft(
      createDraft(
        resolveTemplateStoreId({
          stores,
          requestedStoreId,
          fallbackStoreId: selectedStoreId,
        }),
        prefillBarcode,
      ),
    );
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(template: ProductTemplate, opener: HTMLButtonElement) {
    if (submittingRef.current || uploadingRef.current) return;
    dialogOpenerRef.current = opener;
    void loadTemplate(template.id);
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingRef.current || submittingRef.current) return;
    const generation = editGeneration.current;
    uploadingRef.current = true;
    setUploading(true);
    setFormError(null);
    try {
      const mainImageUrl = await uploadProductImage(file);
      if (!mounted.current || generation !== editGeneration.current) return;
      setDraft((current) => ({ ...current, mainImageUrl }));
      toast.success("商品图片已上传");
    } catch (caught) {
      if (mounted.current && generation === editGeneration.current)
        setFormError(caught instanceof Error ? caught.message : "图片上传失败");
    } finally {
      uploadingRef.current = false;
      if (mounted.current) setUploading(false);
    }
  }

  async function save() {
    if (
      submittingRef.current ||
      uploadingRef.current ||
      editLoadStatus !== "idle"
    )
      return;
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    const generation = editGeneration.current;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        storeId: draft.storeId,
        categoryId: draft.categoryId,
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
              patch: {
                barcode: payload.barcode,
                ...(payload.categoryId !== editing.categoryId
                  ? { categoryId: payload.categoryId }
                  : {}),
                title: payload.title,
                description: payload.description,
                priceCents: payload.priceCents,
                mainImageUrl: payload.mainImageUrl,
              },
            },
            serviceOptions,
          )
        : await createProductTemplate(payload, serviceOptions);

      if (!mounted.current || generation !== editGeneration.current) return;
      if (!editing) rememberTemplateStoreId(saved.storeId);
      if (hasListQuery) void search.refresh();
      else if (saved.storeId === selectedStoreId)
        setTemplates((current) => upsertTemplate(current, saved));
      else
        setTemplates((current) =>
          current.filter((item) => item.id !== saved.id),
        );
      setDialogOpen(false);
      setEditing(null);
      setRequestedEditId(null);
      editGeneration.current += 1;
      toast.success(editing ? "商品模板已更新" : "商品模板已创建");
      if (!editing && saved.storeId !== selectedStoreId)
        router.replace(
          `/group/templates?store=${encodeURIComponent(saved.storeId)}`,
        );
      else router.refresh();
    } catch (caught) {
      if (mounted.current && generation === editGeneration.current)
        setFormError(readErrorMessage(caught));
    } finally {
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  async function removeTemplate() {
    if (!deletingTemplate || deletingRef.current) return;
    const target = deletingTemplate;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deleteProductTemplate({ id: target.id }, serviceOptions);
      if (!mounted.current) return;
      setTemplates((current) =>
        current.filter((template) => template.id !== target.id),
      );
      setDeletingTemplate(null);
      toast.success("商品模板已删除");
      router.refresh();
    } catch (caught) {
      if (!mounted.current) return;
      toast.error(
        caught instanceof Error ? caught.message : "商品模板删除失败",
      );
    } finally {
      deletingRef.current = false;
      if (mounted.current) setDeleting(false);
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
            <Button ref={createButtonRef} type="button" onClick={openCreate}>
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
                    rememberTemplateStoreId(value);
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
                <FieldLabel htmlFor="template-list-category-filter">
                  分类筛选
                </FieldLabel>
                <Select
                  value={listFilter}
                  onValueChange={(value) => {
                    if (selectedStoreId && value)
                      setListSelection({ storeId: selectedStoreId, value });
                  }}
                >
                  <SelectTrigger id="template-list-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="uncategorized">未分类</SelectItem>
                    {listCategoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {listCategoryLabel(category)}
                      </SelectItem>
                    ))}
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
                    maxLength={200}
                    placeholder="商品名称、规格或条码"
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                </InputGroup>
              </Field>
            </div>
          ) : null}

          {searchError ? (
            <LoadFailure
              title="商品模板搜索失败"
              description={searchError}
              onRetry={() => void search.refresh()}
            />
          ) : selectedStoreId && templates.length > 0 ? (
            <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="overflow-hidden">
                  <CardContent className="flex min-w-0 gap-4 p-4">
                    <ManagedImage
                      src={template.mainImageUrl}
                      alt={template.title}
                      fit="contain"
                      className="size-20 shrink-0 rounded-lg border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
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
                          size="sm"
                          variant="text"
                          className="shrink-0"
                          aria-label={`编辑${template.title}`}
                          onClick={(event) =>
                            openEdit(template, event.currentTarget)
                          }
                        >
                          <EditActionLabel>编辑模板</EditActionLabel>
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
          ) : !searching && !loadingMore && !hasMore ? (
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

          {selectedStoreId && !searchError ? (
            <InfiniteListStatus
              hasMore={hasMore}
              loading={searching || loadingMore}
              error={loadMoreError}
              hasItems={totalCount > 0}
              onLoadMore={() => void loadMore()}
              loadingFallback={<TemplateLoadingSkeletons />}
              endMessage={`已经到底，共 ${templates.length} 个商品模板`}
            />
          ) : null}
        </>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:max-w-2xl"
          showCloseButton={!submitting && !uploading}
          onOpenAutoFocus={(event) => {
            if (barcodeInputRef.current) {
              event.preventDefault();
              barcodeInputRef.current.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            const opener = dialogOpenerRef.current;
            const target =
              opener?.isConnected && opener !== document.body
                ? opener
                : createButtonRef.current;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing || requestedEditId ? "编辑商品模板" : "新建商品模板"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              填写商品模板资料
            </DialogDescription>
          </DialogHeader>

          {editLoadStatus === "loading" ? (
            <div
              role="status"
              aria-label="正在加载商品模板详情"
              className="grid min-h-0 flex-1 gap-5 overflow-y-auto sm:grid-cols-2"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : editLoadStatus === "error" ? (
            <LoadFailure
              title="商品模板加载失败"
              description="商品模板暂不可用，请稍后再试"
              onRetry={() => {
                if (requestedEditId) void loadTemplate(requestedEditId);
              }}
            />
          ) : (
            <form
              id="desktop-template-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
              className="min-h-0 overflow-y-auto pr-1"
            >
              <fieldset disabled={submitting || uploading} className="min-w-0">
                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="template-form-category-root">
                      商品分类
                    </FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={categoryRootId}
                        onValueChange={(rootId) => {
                          if (
                            !categories.some(
                              (item) =>
                                item.id === rootId && item.parentId === null,
                            )
                          )
                            return;
                          setCategoryRootId(rootId);
                          const children = categories.filter(
                            (category) => category.parentId === rootId,
                          );
                          setDraft((current) => ({
                            ...current,
                            categoryId: children.length ? "" : rootId,
                          }));
                        }}
                      >
                        <SelectTrigger id="template-form-category-root">
                          <span className="truncate">
                            {categories.find(
                              (category) => category.id === categoryRootId,
                            )?.name ?? "选择一级分类"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categories
                              .filter((category) => category.parentId === null)
                              .map((category) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Select
                        value={
                          categories.find(
                            (category) => category.id === draft.categoryId,
                          )?.parentId
                            ? draft.categoryId
                            : ""
                        }
                        disabled={
                          !categories.some(
                            (category) => category.parentId === categoryRootId,
                          )
                        }
                        onValueChange={(categoryId) => {
                          if (
                            !categories.some(
                              (item) =>
                                item.id === categoryId &&
                                item.parentId === categoryRootId,
                            )
                          )
                            return;
                          setDraft((current) => ({ ...current, categoryId }));
                        }}
                      >
                        <SelectTrigger aria-label="二级分类">
                          <span className="truncate">
                            {categories.find(
                              (category) => category.id === draft.categoryId,
                            )?.name ?? "选择二级分类"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categories
                              .filter(
                                (category) =>
                                  category.parentId === categoryRootId,
                              )
                              .map((category) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    {formError && !draft.categoryId ? (
                      <p role="alert" className="text-sm text-destructive">
                        请选择商品分类
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewCategoryName("");
                          setCategoryCreateParentId(null);
                        }}
                      >
                        新增一级分类
                      </Button>
                      {categoryRootId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNewCategoryName("");
                            setCategoryCreateParentId(categoryRootId);
                          }}
                        >
                          新增二级分类
                        </Button>
                      ) : null}
                      {draft.categoryId &&
                      !categories.some(
                        (category) => category.parentId === draft.categoryId,
                      ) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={categoryBusy}
                          onClick={async () => {
                            if (!draft.storeId || !draft.categoryId) return;
                            setCategoryBusy(true);
                            try {
                              await deleteProductCategory(
                                {
                                  storeId: draft.storeId,
                                  categoryId: draft.categoryId,
                                },
                                serviceOptions,
                              );
                              const result = await listProductCategories(
                                draft.storeId,
                                serviceOptions,
                              );
                              setCategories(result.categories);
                              if (
                                selectedStoreId === draft.storeId &&
                                listFilter === draft.categoryId
                              ) {
                                setListSelection(null);
                              }
                              void listCategories.refresh();
                              setCategoryRootId("");
                              setDraft((current) => ({
                                ...current,
                                categoryId: "",
                              }));
                            } catch (caught) {
                              setFormError(readErrorMessage(caught));
                            } finally {
                              setCategoryBusy(false);
                            }
                          }}
                        >
                          删除所选分类
                        </Button>
                      ) : null}
                    </div>
                    {categoryCreateParentId !== undefined ? (
                      <div className="flex gap-2">
                        <Input
                          aria-label="新分类名称"
                          value={newCategoryName}
                          onChange={(event) =>
                            setNewCategoryName(event.target.value)
                          }
                          placeholder={
                            categoryCreateParentId
                              ? "二级分类名称"
                              : "一级分类名称"
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={categoryBusy}
                          onClick={async () => {
                            if (!draft.storeId || categoryBusy) return;
                            setCategoryBusy(true);
                            try {
                              const category = await createProductCategory(
                                {
                                  storeId: draft.storeId,
                                  name: newCategoryName,
                                  ...(categoryCreateParentId
                                    ? { parentId: categoryCreateParentId }
                                    : {}),
                                },
                                serviceOptions,
                              );
                              setCategories((current) => [
                                ...current,
                                category,
                              ]);
                              void listCategories.refresh();
                              setCategoryRootId(
                                category.parentId ?? category.id,
                              );
                              setDraft((current) => ({
                                ...current,
                                categoryId: category.id,
                              }));
                              setCategoryCreateParentId(undefined);
                            } catch (caught) {
                              setFormError(readErrorMessage(caught));
                            } finally {
                              setCategoryBusy(false);
                            }
                          }}
                        >
                          创建
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setCategoryCreateParentId(undefined)}
                        >
                          取消
                        </Button>
                      </div>
                    ) : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="template-form-store">店铺</FieldLabel>
                    <Select
                      value={draft.storeId}
                      disabled={Boolean(editing) || submitting || uploading}
                      onValueChange={(storeId) => {
                        rememberTemplateStoreId(storeId);
                        setDraft((current) => ({
                          ...current,
                          storeId,
                          categoryId: "",
                        }));
                        setCategoryRootId("");
                      }}
                    >
                      <SelectTrigger id="template-form-store">
                        <span className="truncate">
                          {stores.find((store) => store.id === draft.storeId)
                            ?.name ??
                            (editing ? `店铺 ${draft.storeId}` : "选择店铺")}
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
                    {editing ? (
                      <FieldDescription>
                        编辑时不能更换店铺；请在目标店铺新建模板
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="template-form-barcode">
                      商品条码
                    </FieldLabel>
                    <Input
                      ref={barcodeInputRef}
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
                    <FieldLabel htmlFor="template-form-title">
                      商品名称
                    </FieldLabel>
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
                    <FieldLabel htmlFor="template-form-price">
                      参考价
                    </FieldLabel>
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
                    {draft.mainImageUrl ? (
                      <>
                        <ManagedImage
                          src={draft.mainImageUrl}
                          alt="商品图片预览"
                          sizes="(max-width: 640px) calc(100vw - 48px), 560px"
                          fit="contain"
                          preview
                          className="h-[min(15rem,32dvh)] w-full rounded-lg border"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploading || submitting}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {uploading ? <Spinner /> : <RiImageAddLine />}
                            更改商品图片
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={uploading || submitting}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                mainImageUrl: "",
                              }))
                            }
                          >
                            <RiDeleteBinLine data-icon="inline-start" />
                            移除图片
                          </Button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="flex min-h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={uploading || submitting}
                        aria-label="上传商品图片"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? (
                          <Spinner />
                        ) : (
                          <RiImageAddLine className="size-7 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </Field>
                  {formError ? (
                    <FieldError className="sm:col-span-2">
                      {formError}
                    </FieldError>
                  ) : null}
                </FieldGroup>
              </fieldset>
            </form>
          )}

          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting || uploading}
              onClick={closeDialog}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="desktop-template-form"
              disabled={submitting || uploading || editLoadStatus !== "idle"}
            >
              {submitting ? <Spinner /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingTemplate)}
        onOpenChange={(open) => {
          if (!open && !deletingRef.current) setDeletingTemplate(null);
        }}
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
              disabled={deleting}
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
    categoryId: "",
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
  if (!draft.categoryId) return { ok: false, message: "请选择商品分类" };
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
  if (priceCents > 2147483647) return { ok: false, message: "参考价过高" };
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
