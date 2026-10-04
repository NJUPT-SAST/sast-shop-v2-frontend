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
  const barcode = firstValue(query.barcode) ?? "";

  return (
    <PublishSpotForm
      key={`${entry}:${barcode}`}
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      entry={entry === "scan" ? "scan" : "manual"}
      initialBarcode={barcode}
    />
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
