import { proxyProductImage } from "../../../../../../../server/product-image";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  return proxyProductImage(filename, getServerConnectBaseUrl());
}
