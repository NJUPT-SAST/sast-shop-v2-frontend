import { StoreCreateForm } from "@/components/store-create-form";
import { mobileAppConfig } from "@/lib/app-config";

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
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      returnTo={firstValue(query.returnTo)}
    />
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
