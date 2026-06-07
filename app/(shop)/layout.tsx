import ShopShell from "./shop-shell"

// Server component so `generateStaticParams` in nested dynamic routes is
// honoured under `output: "export"`. The actual auth/nav lives in the client
// shell below.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopShell>{children}</ShopShell>
}
