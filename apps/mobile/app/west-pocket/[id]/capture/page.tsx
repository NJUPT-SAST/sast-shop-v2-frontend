import { notFound } from "next/navigation";
import { PocketCapture } from "@/components/west-pocket/pocket-capture";
export default async function CapturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  return <PocketCapture key={id} pocketId={id} />;
}
