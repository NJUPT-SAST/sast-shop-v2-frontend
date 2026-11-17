import { notFound } from "next/navigation";
import { AdminRecordsView } from "@/components/admin/admin-records";
import { AdminAuditView } from "@/components/admin/admin-audit";
import {
  findAdminSection,
  type AdminResourceSection,
} from "@/lib/admin-navigation";
import { sectionResources } from "@/lib/admin-fields";

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const initialId =
    typeof query.id === "string" && query.id.length < 100
      ? query.id
      : undefined;
  const config = findAdminSection(section);
  if (!config || config.key === "overview") notFound();
  if (config.key === "audit") return <AdminAuditView />;
  return (
    <AdminRecordsView
      key={`${section}:${initialId ?? ""}`}
      initialId={initialId}
      resource={sectionResources[config.key as AdminResourceSection]}
      title={config.title}
      description={config.description}
    />
  );
}
