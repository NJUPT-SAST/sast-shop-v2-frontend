import { PublishSpotForm } from "@/components/publish-spot-form";
import { mobileAppConfig } from "@/lib/app-config";

type PublishSpotPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublishSpotPage({
  searchParams,
}: PublishSpotPageProps) {
  const query: Record<string, string | string[] | undefined> =
    await (searchParams ?? Promise.resolve({}));
  const entry = firstValue(query.entry);

  return (
    <PublishSpotForm
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      entry={entry === "scan" ? "scan" : "manual"}
    />
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
