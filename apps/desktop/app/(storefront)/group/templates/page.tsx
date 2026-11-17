import { randomUUID } from "node:crypto";
import { CachedProductTemplates } from "@/components/cached-product-templates";
import { desktopAppConfig } from "@/lib/app-config";

type ProductTemplatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ProductTemplatesPage({
  searchParams,
}: ProductTemplatesPageProps) {
  const query = await (searchParams ??
    Promise.resolve({} as Record<string, string | string[] | undefined>));
  const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return (
    <CachedProductTemplates
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
      requestedStoreId={firstValue(query.store)}
      requestedTemplateId={firstValue(query.edit)}
      prefillBarcode={firstValue(query.barcode) ?? ""}
      startCreating={firstValue(query.create) === "1"}
    />
  );
}
