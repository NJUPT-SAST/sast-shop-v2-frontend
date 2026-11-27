"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMobileRouter as useRouter } from "@/components/mobile-navigation-feedback";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiAddLine,
  RiBarcodeLine,
  RiDeleteBinLine,
  RiEditLine,
  RiImageAddLine,
  RiQrScan2Line,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  withLarkPageJsapi,
  createProductTemplate,
  createProductCategory,
  deleteProductCategory,
  getProductTemplate,
  deleteProductTemplate,
  isLarkScanCancelledError,
  listProductTemplatesPage,
  listProductCategories,
  scanLarkBarcode,
  updateProductTemplate,
  type DataSource,
  type ProductTemplate,
  type ProductCategory,
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
import { InfiniteListStatus } from "@/components/infinite-list-status";
import { LoadFailure } from "@/components/load-failure";
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
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";

import { BrandIllustration } from "@/components/brand-illustration";
import { ManagedImage } from "@/components/managed-image";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { useMobileKeyboard } from "@/hooks/use-mobile-keyboard";
import { MobileFixedFooter } from "./mobile-fixed-footer";
import { isJsapiAuthConfig } from "@/lib/jsapi-config";
import { uploadProductImage } from "@/lib/product-image-upload";
import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";
import {
  rememberTemplateStoreId,
  resolveTemplateStoreId,
} from "@/lib/template-store-preference";

const templateSchema = z.object({
  storeId: z.string().min(1, "请选择店铺"),
  categoryId: z.string(),
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
  requestedStoreId?: string;
  requestedTemplateId?: string;
  prefillBarcode: string;
  startCreating: boolean;
  error: string | null;
  templatesLoading?: boolean;
  onRetry?: () => void;
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
  templatesLoading = false,
  onRetry,
}: ProductTemplateManagerProps) {
  const router = useRouter();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const isKeyboardOpen = useMobileKeyboard();
  const [storeCreateOpen, setStoreCreateOpen] = useState(false);
  const serviceOptions = useMemo<ServiceOptions>(
    () => ({ dataSource, connectBaseUrl }),
    [dataSource, connectBaseUrl],
  );
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryRootId, setCategoryRootId] = useState("");
  const [categoryCreateParentId, setCategoryCreateParentId] = useState<
    string | null | undefined
  >(undefined);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [keyword, setKeyword] = useState("");
  const normalizedQuery = query.trim();
  useEffect(() => {
    const timeout = window.setTimeout(() => setKeyword(query.trim()), 250);
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
      "mobile:template-list-categories",
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
  const hasListQuery = Boolean(keyword || listFilter !== "all");
  const search = useCachedResource({
    cacheKey: JSON.stringify([
      "mobile:templates:search",
      dataSource,
      connectBaseUrl,
      selectedStoreId,
      initialPage.pageSize,
      keyword,
      listFilter,
    ]),
    staleTime: 60_000,
    refreshKey: initialPage,
    load: () =>
      hasListQuery && selectedStoreId
        ? listProductTemplatesPage({
            dataSource,
            connectBaseUrl,
            storeId: selectedStoreId,
            ...filterOptions,
            keyword,
            page: 1,
            pageSize: initialPage.pageSize,
          })
        : Promise.resolve(initialPage),
  });
  const searching =
    normalizedQuery !== keyword ||
    Boolean(hasListQuery && selectedStoreId && !search.data && !search.error);
  const listLoading = searching || (!hasListQuery && templatesLoading);
  const pageError =
    normalizedQuery !== keyword
      ? null
      : hasListQuery
        ? search.error
          ? "商品模板暂不可用，请稍后再试"
          : null
        : error;
  const page =
    normalizedQuery !== keyword
      ? undefined
      : hasListQuery && selectedStoreId
        ? search.data
        : initialPage;
  const firstPage = useMemo(
    () =>
      page ?? {
        items: [],
        currentPage: 1,
        pageSize: initialPage.pageSize,
        totalCount: 0,
        hasMore: false,
      },
    [page, initialPage.pageSize],
  );
  const loadPage = useCallback(
    (page: number) => {
      if (!selectedStoreId) return Promise.resolve(initialPage);
      return listProductTemplatesPage({
        dataSource,
        connectBaseUrl,
        storeId: selectedStoreId,
        ...filterOptions,
        keyword,
        page,
        pageSize: initialPage.pageSize,
      });
    },
    [
      connectBaseUrl,
      dataSource,
      initialPage,
      selectedStoreId,
      keyword,
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
      normalizedQuery,
      listFilter,
      keyword,
    ]),
  });
  const [editingTemplate, setEditingTemplate] =
    useState<ProductTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(
    Boolean(requestedTemplateId) || (startCreating && Boolean(selectedStoreId)),
  );
  const [requestedEditId, setRequestedEditId] = useState<string | null>(
    requestedTemplateId || null,
  );
  const [editLoadStatus, setEditLoadStatus] = useState<
    "idle" | "loading" | "error"
  >(requestedTemplateId ? "loading" : "idle");
  const editRequestGeneration = useRef(0);
  const consumedEditRequest = useRef<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageUploadingRef = useRef(false);
  const imageUploadCountRef = useRef(0);
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
  const activeStoreId = useWatch({ control: form.control, name: "storeId" });
  useEffect(() => {
    let active = true;
    if (!activeStoreId) {
      return () => {
        active = false;
      };
    }
    void listProductCategories(activeStoreId, serviceOptions)
      .then((result) => {
        if (!active) return;
        setCategories(result.categories);
        const selected = form.getValues("categoryId");
        const selectedCategory = result.categories.find(
          (category) => category.id === selected,
        );
        const firstRoot = result.categories.find(
          (category) => category.parentId === null,
        );
        const rootId =
          selectedCategory?.parentId ??
          selectedCategory?.id ??
          (result.categories.filter((item) => item.parentId === null).length ===
          1
            ? firstRoot?.id
            : undefined) ??
          "";
        setCategoryRootId(rootId);
        if (!editingTemplate && !selected) {
          const children = result.categories.filter(
            (category) => category.parentId === rootId,
          );
          form.setValue("categoryId", children.length ? "" : rootId, {
            shouldValidate: true,
          });
        }
      })
      .catch(() => {
        if (active) toast.error("分类加载失败，请稍后重试");
      });
    return () => {
      active = false;
    };
  }, [activeStoreId, editingTemplate, form, serviceOptions]);
  const handleImageUploadingChange = useCallback((uploading: boolean) => {
    imageUploadCountRef.current = Math.max(
      0,
      imageUploadCountRef.current + (uploading ? 1 : -1),
    );
    imageUploadingRef.current = imageUploadCountRef.current > 0;
    if (mountedRef.current) setImageUploading(imageUploadingRef.current);
  }, []);

  const loadRequestedTemplate = useCallback(
    async (id: string) => {
      const generation = ++editRequestGeneration.current;
      setRequestedEditId(id);
      setEditLoadStatus("loading");
      setEditingTemplate(null);
      setDeleteConfirmOpen(false);
      setSaveError(null);
      setDeleteError(null);
      setDrawerOpen(true);
      try {
        const template = await getProductTemplate(id, serviceOptions);
        if (!mountedRef.current || generation !== editRequestGeneration.current)
          return;
        if (template.id !== id) throw new Error("商品模板身份已变化");
        setEditingTemplate(template);
        form.reset({
          storeId: template.storeId,
          categoryId: template.categoryId ?? "",
          barcode: template.barcode,
          title: template.title,
          description: template.description,
          price: template.priceCents / 100,
          mainImageUrl: template.mainImageUrl,
        });
        setEditLoadStatus("idle");
      } catch {
        if (!mountedRef.current || generation !== editRequestGeneration.current)
          return;
        setEditLoadStatus("error");
      }
    },
    [form, serviceOptions],
  );

  useEffect(() => {
    if (!requestedTemplateId) {
      if (consumedEditRequest.current !== null) {
        consumedEditRequest.current = null;
        editRequestGeneration.current += 1;
        setRequestedEditId(null);
        setEditLoadStatus("idle");
        setEditingTemplate(null);
        setDrawerOpen(false);
      }
      return;
    }
    const request = JSON.stringify([
      dataSource,
      connectBaseUrl,
      requestedTemplateId,
    ]);
    if (consumedEditRequest.current === request) return;
    consumedEditRequest.current = request;
    void loadRequestedTemplate(requestedTemplateId);
  }, [connectBaseUrl, dataSource, loadRequestedTemplate, requestedTemplateId]);

  function clearRequestedEdit() {
    editRequestGeneration.current += 1;
    setRequestedEditId(null);
    setEditLoadStatus("idle");
  }

  function openCreateDrawer() {
    clearRequestedEdit();
    setSaveError(null);
    setDeleteError(null);
    setEditingTemplate(null);
    const createStoreId = resolveTemplateStoreId({
      stores,
      requestedStoreId,
      fallbackStoreId: selectedStoreId,
    });
    const roots = categories.filter(
      (category) =>
        category.storeId === createStoreId && category.parentId === null,
    );
    const firstRoot = roots.length === 1 ? roots[0] : undefined;
    const firstRootChildren = categories.filter(
      (category) => category.parentId === firstRoot?.id,
    );
    setCategoryRootId(firstRoot?.id ?? "");
    form.reset(
      createDefaultValues(
        createStoreId,
        prefillBarcode,
        firstRootChildren.length ? "" : (firstRoot?.id ?? ""),
      ),
    );
    setDrawerOpen(true);
  }

  function openEditDrawer(template: ProductTemplate) {
    clearRequestedEdit();
    setSaveError(null);
    setDeleteError(null);
    setEditingTemplate(template);
    form.reset({
      storeId: template.storeId,
      categoryId: template.categoryId ?? "",
      barcode: template.barcode,
      title: template.title,
      description: template.description,
      price: template.priceCents / 100,
      mainImageUrl: template.mainImageUrl,
    });
    setDrawerOpen(true);
  }

  async function scanTemplateBarcode() {
    if (scanningBarcodeRef.current || submittingRef.current) return;
    if (!window.h5sdk || !window.tt) {
      toast.message("飞书扫码组件尚未就绪，请稍后重试或手动输入");
      return;
    }

    scanningBarcodeRef.current = true;
    setScanningBarcode(true);
    const client = window.tt;
    const generation = editRequestGeneration.current;
    try {
      const barcode = await withLarkPageJsapi(
        window.h5sdk,
        async (signingUrl) => {
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
          return body;
        },
        () => scanLarkBarcode(client),
      );
      if (!mountedRef.current || generation !== editRequestGeneration.current)
        return;
      form.setValue("barcode", barcode, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      toast.success("已识别商品条码");
    } catch (reason) {
      if (!mountedRef.current || generation !== editRequestGeneration.current)
        return;
      if (isLarkScanCancelledError(reason)) return;
      toast.error(
        reason instanceof Error ? reason.message : "扫码失败，请手动输入条码",
      );
    } finally {
      scanningBarcodeRef.current = false;
      if (mountedRef.current) setScanningBarcode(false);
    }
  }

  async function saveTemplate(values: TemplateFormValues) {
    if (
      submittingRef.current ||
      imageUploadingRef.current ||
      scanningBarcodeRef.current
    )
      return;

    const categoryId =
      values.categoryId ||
      (() => {
        const roots = categories.filter(
          (category) =>
            category.storeId === values.storeId && category.parentId === null,
        );
        if (roots.length !== 1) return "";
        return categories.some((category) => category.parentId === roots[0]?.id)
          ? ""
          : (roots[0]?.id ?? "");
      })();
    if (!categoryId) {
      form.setError("categoryId", {
        type: "manual",
        message: "请选择商品分类",
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    const generation = editRequestGeneration.current;

    try {
      const fields = {
        barcode: values.barcode,
        title: values.title,
        description: values.description,
        priceCents: Math.round(values.price * 100),
        mainImageUrl: values.mainImageUrl,
      };
      const saved = editingTemplate
        ? await updateExistingTemplate(
            editingTemplate,
            {
              ...fields,
              ...(categoryId !== editingTemplate.categoryId
                ? { categoryId }
                : {}),
            },
            serviceOptions,
          )
        : await createProductTemplate(
            { ...fields, storeId: values.storeId, categoryId },
            serviceOptions,
          );
      if (!mountedRef.current || generation !== editRequestGeneration.current)
        return;
      if (!editingTemplate) rememberTemplateStoreId(saved.storeId);

      if (hasListQuery) {
        void search.refresh();
      } else if (saved.storeId === selectedStoreId) {
        setTemplates((current) => upsertTemplate(current, saved));
      } else {
        setTemplates((current) =>
          current.filter((template) => template.id !== saved.id),
        );
      }
      setDrawerOpen(false);
      clearRequestedEdit();
      setEditingTemplate(null);
      toast.success(editingTemplate ? "商品模板已更新" : "商品模板已创建");
      if (!editingTemplate && saved.storeId !== selectedStoreId) {
        const navigationGeneration = editRequestGeneration.current;
        await waitForDrawerHistoryCleanup();
        if (
          !mountedRef.current ||
          navigationGeneration !== editRequestGeneration.current
        )
          return;
        router.replace(
          `/group/templates?store=${encodeURIComponent(saved.storeId)}`,
        );
      } else {
        router.refresh();
      }
    } catch (caught) {
      if (mountedRef.current && generation === editRequestGeneration.current)
        setSaveError(readErrorMessage(caught));
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function deleteTemplate() {
    if (!editingTemplate || deleting) return;
    const generation = editRequestGeneration.current;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProductTemplate({ id: editingTemplate.id }, serviceOptions);
      if (!mountedRef.current || generation !== editRequestGeneration.current)
        return;
      setTemplates((current) =>
        current.filter((template) => template.id !== editingTemplate.id),
      );
      setDeleteConfirmOpen(false);
      setDrawerOpen(false);
      clearRequestedEdit();
      setEditingTemplate(null);
      toast.success("商品模板已删除");
      router.refresh();
    } catch (caught) {
      if (mountedRef.current && generation === editRequestGeneration.current)
        setDeleteError(
          caught instanceof Error ? caught.message : "商品模板删除失败",
        );
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 pb-4 pt-6">
      <h1 className="min-w-0 text-xl font-semibold leading-7 md:text-2xl">
        商品模板
      </h1>

      {stores.length > 0 ? (
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="template-store">当前店铺</FieldLabel>
            <Select
              value={selectedStoreId ?? undefined}
              onValueChange={(value) => {
                rememberTemplateStoreId(value);
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
            <FieldDescription>
              没找到想要的店铺？{" "}
              <StoreCreateDialog
                open={storeCreateOpen}
                onOpenChange={setStoreCreateOpen}
                dataSource={dataSource}
                connectBaseUrl={connectBaseUrl}
                returnTo={createStoreReturnTo}
              >
                <Button
                  type="button"
                  variant="plain"
                  size="touch"
                  className="-my-2 px-0"
                >
                  添加店铺
                </Button>
              </StoreCreateDialog>
            </FieldDescription>
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
            <FieldLabel htmlFor="template-search">搜索模板</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiSearchLine />
              </InputGroupAddon>
              <InputGroupInput
                id="template-search"
                value={query}
                maxLength={200}
                placeholder="搜索商品名称、规格或条码"
                onChange={(event) => setQuery(event.target.value)}
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      ) : null}

      {listLoading ? <TemplateLoadingSkeletons /> : null}
      {pageError ? (
        <LoadFailure
          variant="section"
          title="商品模板加载失败"
          description={pageError}
          onRetry={() =>
            hasListQuery
              ? void search.refresh()
              : onRetry
                ? onRetry()
                : router.refresh()
          }
        />
      ) : null}

      {!listLoading && !pageError && templates.length > 0 ? (
        <section
          className="flex min-w-0 flex-col gap-3"
          aria-label="商品模板列表"
        >
          {templates.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              onEdit={() => openEditDrawer(template)}
            />
          ))}
        </section>
      ) : !pageError && !listLoading && !loadingMore && !hasMore ? (
        <Empty
          className="flex-1"
          illustration={
            stores.length === 0 ? (
              <BrandIllustration name="store" size={96} />
            ) : !keyword ? (
              <BrandIllustration name="template" size={96} />
            ) : (
              <BrandIllustration name="search-empty" size={112} />
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
                open={storeCreateOpen}
                onOpenChange={setStoreCreateOpen}
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

      {!pageError && !listLoading && selectedStoreId ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<TemplateLoadingSkeletons />}
          endMessage={
            keyword
              ? `搜索完成，共找到 ${totalCount} 个商品模板`
              : `已经到底，共 ${templates.length} 个商品模板`
          }
          endMessageClassName="pt-6"
        />
      ) : null}

      {selectedStoreId && !drawerOpen && !storeCreateOpen && !isKeyboardOpen ? (
        <MobileFixedFooter
          reserveSpace={false}
          className="pointer-events-none border-0 bg-transparent px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-none md:border-0 [&>div]:justify-end"
        >
          <Button
            type="button"
            size="icon-touch"
            className="pointer-events-auto size-14 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6"
            aria-label="新建模板"
            onClick={openCreateDrawer}
          >
            <RiAddLine aria-hidden="true" />
          </Button>
        </MobileFixedFooter>
      ) : null}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (
            !submittingRef.current &&
            !imageUploadingRef.current &&
            !scanningBarcodeRef.current
          ) {
            if (!open) clearRequestedEdit();
            setDrawerOpen(open);
          }
        }}
      >
        <DrawerContent className="max-h-[88dvh] overflow-clip">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>
              {editingTemplate || requestedEditId
                ? "编辑商品模板"
                : "新建商品模板"}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              填写并保存商品模板
            </DrawerDescription>
          </DrawerHeader>

          {editLoadStatus !== "idle" ? (
            <>
              {editLoadStatus === "loading" ? (
                <TemplateEditorSkeleton />
              ) : (
                <LoadFailure
                  surface="plain"
                  title="商品模板详情加载失败"
                  description="暂时无法读取这个商品模板，请重新加载"
                  onRetry={() => {
                    if (requestedEditId)
                      void loadRequestedTemplate(requestedEditId);
                  }}
                />
              )}
              <DrawerFooter className="border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    clearRequestedEdit();
                    setDrawerOpen(false);
                  }}
                >
                  返回模板列表
                </Button>
              </DrawerFooter>
            </>
          ) : (
            <>
              {editingTemplate && !editingTemplate.updatedAt ? (
                <p className="px-4 text-sm text-destructive">
                  缺少模板版本，刷新页面后再编辑。
                </p>
              ) : null}

              <form
                id="product-template-form"
                className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4"
                noValidate
                onSubmit={(event) =>
                  void form.handleSubmit(saveTemplate)(event)
                }
              >
                <TemplateFields
                  form={form}
                  stores={stores}
                  categories={categories}
                  categoryRootId={categoryRootId}
                  onCategoryRootChange={(rootId) => {
                    setCategoryRootId(rootId);
                    const children = categories.filter(
                      (category) => category.parentId === rootId,
                    );
                    form.setValue("categoryId", children.length ? "" : rootId, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  onCreateRootCategory={() => {
                    setNewCategoryName("");
                    setCategoryCreateParentId(null);
                  }}
                  onCreateChildCategory={() => {
                    setNewCategoryName("");
                    setCategoryCreateParentId(categoryRootId);
                  }}
                  onCreateCategory={async () => {
                    if (!activeStoreId || categoryBusy) return;
                    setCategoryBusy(true);
                    try {
                      const category = await createProductCategory(
                        {
                          storeId: activeStoreId,
                          name: newCategoryName,
                          ...(categoryCreateParentId
                            ? { parentId: categoryCreateParentId }
                            : {}),
                        },
                        serviceOptions,
                      );
                      setCategories((current) => [...current, category]);
                      void listCategories.refresh();
                      setCategoryRootId(category.parentId ?? category.id);
                      form.setValue("categoryId", category.id, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      setCategoryCreateParentId(undefined);
                    } catch (caught) {
                      toast.error(
                        caught instanceof Error
                          ? caught.message
                          : "分类创建失败",
                      );
                    } finally {
                      setCategoryBusy(false);
                    }
                  }}
                  categoryCreateOpen={categoryCreateParentId !== undefined}
                  categoryCreateParentId={categoryCreateParentId}
                  newCategoryName={newCategoryName}
                  onNewCategoryNameChange={setNewCategoryName}
                  onCancelCategoryCreate={() =>
                    setCategoryCreateParentId(undefined)
                  }
                  onDeleteCategory={async () => {
                    const categoryId = form.getValues("categoryId");
                    if (
                      !activeStoreId ||
                      !categoryId ||
                      categoryBusy ||
                      categories.some(
                        (category) => category.parentId === categoryId,
                      )
                    )
                      return;
                    setCategoryBusy(true);
                    try {
                      await deleteProductCategory(
                        { storeId: activeStoreId, categoryId },
                        serviceOptions,
                      );
                      const next = await listProductCategories(
                        activeStoreId,
                        serviceOptions,
                      );
                      setCategories(next.categories);
                      if (
                        selectedStoreId === activeStoreId &&
                        listFilter === categoryId
                      ) {
                        setListSelection(null);
                      }
                      void listCategories.refresh();
                      setCategoryRootId("");
                      form.setValue("categoryId", "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    } catch (caught) {
                      toast.error(
                        caught instanceof Error
                          ? caught.message
                          : "分类删除失败",
                      );
                    } finally {
                      setCategoryBusy(false);
                    }
                  }}
                  categoryBusy={categoryBusy}
                  lockStore={Boolean(editingTemplate)}
                  scanEnabled={showFeishuEntry}
                  submitting={submitting}
                  scanningBarcode={scanningBarcode}
                  onScanBarcode={() => void scanTemplateBarcode()}
                  onImageUploadingChange={handleImageUploadingChange}
                  onStoreChange={(storeId) => {
                    rememberTemplateStoreId(storeId);
                    setCategoryRootId("");
                    form.setValue("categoryId", "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                />
              </form>

              {saveError ? (
                <p role="alert" className="px-4 pb-4 text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}

              <DrawerFooter className="border-t">
                {editingTemplate ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    aria-label="删除商品模板"
                    disabled={submitting || imageUploading || scanningBarcode}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <RiDeleteBinLine data-icon="inline-start" />
                    删除模板
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  form="product-template-form"
                  size="lg"
                  disabled={
                    submitting ||
                    imageUploading ||
                    scanningBarcode ||
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
              </DrawerFooter>
            </>
          )}
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
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
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
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="正在加载更多商品模板"
    >
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

function TemplateEditorSkeleton() {
  return (
    <div
      className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4"
      role="status"
      aria-label="正在加载商品模板详情"
    >
      <div className="flex flex-col gap-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
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
        <ManagedImage
          fit="contain"
          src={template.mainImageUrl}
          alt={template.title}
          className="size-10 shrink-0 rounded-lg"
          sizes="40px"
        />
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
  categories,
  categoryRootId,
  onCategoryRootChange,
  onCreateRootCategory,
  onCreateChildCategory,
  onCreateCategory,
  categoryCreateOpen,
  categoryCreateParentId,
  newCategoryName,
  onNewCategoryNameChange,
  onCancelCategoryCreate,
  onDeleteCategory,
  categoryBusy,
  lockStore,
  scanEnabled,
  submitting,
  scanningBarcode,
  onScanBarcode,
  onImageUploadingChange,
  onStoreChange,
}: {
  form: ReturnType<typeof useForm<TemplateFormValues>>;
  stores: Store[];
  categories: ProductCategory[];
  categoryRootId: string;
  onCategoryRootChange: (id: string) => void;
  onCreateRootCategory: () => void;
  onCreateChildCategory: () => void;
  onCreateCategory: () => void;
  categoryCreateOpen: boolean;
  categoryCreateParentId: string | null | undefined;
  newCategoryName: string;
  onNewCategoryNameChange: (name: string) => void;
  onCancelCategoryCreate: () => void;
  onDeleteCategory: () => void;
  categoryBusy: boolean;
  lockStore: boolean;
  scanEnabled: boolean;
  submitting: boolean;
  scanningBarcode: boolean;
  onScanBarcode: () => void;
  onImageUploadingChange: (uploading: boolean) => void;
  onStoreChange: (storeId: string) => void;
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
              onValueChange={(value) => {
                field.onChange(value);
                if (!lockStore) onStoreChange(value);
              }}
            >
              <SelectTrigger
                id={field.name}
                aria-label="店铺"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid
                    ? `template-${field.name}-error`
                    : undefined
                }
              >
                <span className="truncate">
                  {stores.find((store) => store.id === field.value)?.name ??
                    (lockStore ? `店铺 ${field.value}` : "选择店铺")}
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
                编辑时不能更换店铺；请在目标店铺新建模板
              </FieldDescription>
            ) : null}
            <FieldError
              id={`template-${field.name}-error`}
              errors={[fieldState.error]}
            />
          </Field>
        )}
      />

      <Controller
        name="categoryId"
        control={form.control}
        render={({ field, fieldState }) => {
          const roots = categories.filter(
            (category) => category.parentId === null,
          );
          const children = categories.filter(
            (category) => category.parentId === categoryRootId,
          );
          const selected = categories.find(
            (category) => category.id === field.value,
          );
          return (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>商品分类</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={categoryRootId}
                  onValueChange={(id) => {
                    if (roots.some((category) => category.id === id))
                      onCategoryRootChange(id);
                  }}
                >
                  <SelectTrigger aria-label="一级分类">
                    <span className="truncate">
                      {roots.find((category) => category.id === categoryRootId)
                        ?.name ?? "选择一级分类"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {roots.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={selected?.parentId ? field.value : ""}
                  disabled={!children.length}
                  onValueChange={(id) => {
                    if (children.some((category) => category.id === id))
                      field.onChange(id);
                  }}
                >
                  <SelectTrigger aria-label="二级分类">
                    <span className="truncate">
                      {children.find((category) => category.id === field.value)
                        ?.name ??
                        (children.length ? "选择二级分类" : "无二级分类")}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {children.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <FieldError errors={[fieldState.error]} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={categoryBusy}
                  onClick={onCreateRootCategory}
                >
                  新增一级分类
                </Button>
                {categoryRootId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={categoryBusy}
                    onClick={onCreateChildCategory}
                  >
                    新增二级分类
                  </Button>
                ) : null}
                {field.value &&
                !categories.some(
                  (category) => category.parentId === field.value,
                ) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={categoryBusy}
                    onClick={onDeleteCategory}
                  >
                    删除所选分类
                  </Button>
                ) : null}
              </div>
              {categoryCreateOpen ? (
                <div className="flex gap-2">
                  <Input
                    aria-label="新分类名称"
                    value={newCategoryName}
                    onChange={(event) =>
                      onNewCategoryNameChange(event.target.value)
                    }
                    placeholder={
                      categoryCreateParentId ? "二级分类名称" : "一级分类名称"
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={categoryBusy}
                    onClick={onCreateCategory}
                  >
                    创建
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onCancelCategoryCreate}
                  >
                    取消
                  </Button>
                </div>
              ) : null}
              {categories.length === 0 ? (
                <FieldDescription>请先创建商品分类</FieldDescription>
              ) : null}
            </Field>
          );
        }}
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
                aria-describedby={
                  fieldState.invalid
                    ? `template-${field.name}-error`
                    : undefined
                }
                disabled={scanningBarcode || submitting}
              />
              {scanEnabled ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-touch"
                    aria-label="扫码填写商品条码"
                    title="扫码"
                    disabled={scanningBarcode || submitting}
                    onClick={onScanBarcode}
                  >
                    {scanningBarcode ? <Spinner /> : <RiQrScan2Line />}
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <FieldError
              id={`template-${field.name}-error`}
              errors={[fieldState.error]}
            />
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
              aria-describedby={
                fieldState.invalid ? `template-${field.name}-error` : undefined
              }
            />
            <FieldError
              id={`template-${field.name}-error`}
              errors={[fieldState.error]}
            />
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
              aria-describedby={
                fieldState.invalid ? `template-${field.name}-error` : undefined
              }
            />
            <FieldError
              id={`template-${field.name}-error`}
              errors={[fieldState.error]}
            />
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
                aria-describedby={
                  fieldState.invalid
                    ? `template-${field.name}-error`
                    : undefined
                }
              />
            </InputGroup>
            <FieldError
              id={`template-${field.name}-error`}
              errors={[fieldState.error]}
            />
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
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    onUploadingChange(true);
    setUploadError(null);
    try {
      const url = await uploadProductImage(file);
      if (mountedRef.current) onChange(url);
    } catch (caught) {
      if (mountedRef.current)
        setUploadError(
          caught instanceof Error ? caught.message : "图片上传失败",
        );
    } finally {
      if (mountedRef.current) setUploading(false);
      onUploadingChange(false);
      event.target.value = "";
    }
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="product-template-image">商品图片</FieldLabel>
      <div className="relative overflow-hidden rounded-lg border bg-muted/30">
        {value ? (
          <ManagedImage
            fit="contain"
            preview={!uploading}
            src={value}
            alt="商品图片预览"
            sizes="(max-width: 640px) calc(100vw - 32px), 608px"
            className="h-[min(15rem,32dvh)] w-full rounded-none"
          />
        ) : (
          <button
            type="button"
            className="relative flex h-[min(15rem,32dvh)] w-full items-center justify-center overflow-hidden outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="上传商品图片"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <RiImageAddLine className="size-8 text-muted-foreground" />
          </button>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Spinner className="size-6" />
          </span>
        ) : null}

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
  categoryId = "",
): TemplateFormValues {
  return {
    storeId: storeId ?? "",
    categoryId,
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
    categoryId?: string;
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
