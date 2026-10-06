import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { PocketDetailPage } from "@/components/pocket/pocket-detail";
export default async function PocketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  return <PocketDetailPage key={id} pocketId={id} refreshKey={randomUUID()} />;
}
