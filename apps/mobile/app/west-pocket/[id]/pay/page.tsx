import { notFound } from "next/navigation";
import { PocketPaymentPage } from "@/components/west-pocket/pocket-payment";
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  return <PocketPaymentPage key={id} pocketId={id} />;
}
