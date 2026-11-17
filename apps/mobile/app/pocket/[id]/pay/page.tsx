import { notFound, redirect } from "next/navigation";
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  const { round } = await searchParams;
  const suffix =
    typeof round === "string" ? `&round=${encodeURIComponent(round)}` : "";
  redirect(`/pocket/${id}?payment=1${suffix}`);
}
