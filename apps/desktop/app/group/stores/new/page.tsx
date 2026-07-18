import { StoreCreateForm } from "@/components/store-create-form";
import { desktopAppConfig } from "@/lib/app-config";

type NewStorePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewStorePage({
  searchParams,
}: NewStorePageProps) {
  const query: Record<string, string | string[] | undefined> =
    await (searchParams ?? Promise.resolve({}));

  return (
    <StoreCreateForm
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      returnTo={firstValue(query.returnTo)}
    />
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
