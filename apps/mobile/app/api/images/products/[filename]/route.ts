import { proxyProductImage } from "../../../../../../../server/product-image";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  return proxyProductImage(
    filename,
    process.env.PRODUCT_IMAGE_BASE_URL ?? getServerConnectBaseUrl(),
  );
}
