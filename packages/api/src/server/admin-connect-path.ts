const adminPrefix = "sast.sastshopv2.admin.v1.";
const services = new Set([
  "UserAdminService",
  "CatalogAdminService",
  "SpotAdminService",
  "ErrandAdminService",
  "PaymentAdminService",
  "WestPocketAdminService",
]);
const methods = new Set([
  "ListRecords",
  "GetRecord",
  "MutateRecord",
  "PreviewCorrection",
  "ExecuteCorrection",
  "GetCorrection",
  "ListCorrections",
  "ListAudit",
  "GetStats",
]);

export function isAdminConnectPath(path: readonly string[]): boolean {
  if (path.length !== 2 || !path[0].startsWith(adminPrefix)) return false;
  const service = path[0].slice(adminPrefix.length);
  if (!services.has(service)) return false;
  return (
    methods.has(path[1]) ||
    (service === "UserAdminService" && path[1] === "GetContext")
  );
}
