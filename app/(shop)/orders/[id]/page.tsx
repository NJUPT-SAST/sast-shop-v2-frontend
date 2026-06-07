import OrderDetailView from "./order-detail"

// Next.js 16 + `output: "export"` requires at least one entry. We seed a
// placeholder ID; the client-router fetches the real ID via React Query.
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: "_" }]
}

export default function OrderDetailPage() {
  return <OrderDetailView />
}
