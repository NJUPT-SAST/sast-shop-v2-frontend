import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { PocketDetailPage } from "@/components/pocket/pocket-detail";
export default async function PocketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  const query = await searchParams;
  return (
    <PocketDetailPage
      key={id}
      pocketId={id}
      refreshKey={randomUUID()}
      initialPaymentOpen={query.payment === "1"}
    />
  );
}
