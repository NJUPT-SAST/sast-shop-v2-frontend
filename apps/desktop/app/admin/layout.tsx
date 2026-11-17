import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSessionProvider } from "@/components/admin/admin-session";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "管理后台 · SAST 商城" };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
