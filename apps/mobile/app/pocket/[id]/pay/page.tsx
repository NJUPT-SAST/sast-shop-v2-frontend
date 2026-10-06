import { notFound, redirect } from "next/navigation";
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,18}$/.test(id)) notFound();
  redirect(`/pocket/${id}?payment=1`);
}
