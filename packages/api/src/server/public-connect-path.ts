import { ProductTemplateService } from "../gen/sast/sastshopv2/catalog/v1/product_template_service_pb";
import { CatalogService } from "../gen/sast/sastshopv2/catalog/v1/store_service_pb";
import { BuyerErrandOrderService } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_service_pb";
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb";
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb";
import { BillService } from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { QrCodeService } from "../gen/sast/sastshopv2/payment/v1/qr_code_service_pb";
import { SpotGoodsService } from "../gen/sast/sastshopv2/spot/v1/spot_goods_service_pb";
import { SpotOrderService } from "../gen/sast/sastshopv2/spot/v1/spot_order_service_pb";
import { AddressService } from "../gen/sast/sastshopv2/user/v1/address_service_pb";
import { UserService } from "../gen/sast/sastshopv2/user/v1/user_service_pb";
import {
  FaceProfileService,
  WestPocketService,
} from "../gen/sast/sastshopv2/westpocket/v1/west_pocket_pb";

// Only browser-facing services belong here. Internal RPCs and AuthService
// must remain accessible exclusively through their dedicated server callers.
const publicServices = [
  ProductTemplateService,
  CatalogService,
  BuyerErrandOrderService,
  ErrandDemandService,
  ErrandTaskService,
  BillService,
  QrCodeService,
  SpotGoodsService,
  SpotOrderService,
  AddressService,
  UserService,
  FaceProfileService,
  WestPocketService,
];

const publicPaths = new Set(
  publicServices.flatMap((service) =>
    service.methods.map((method) => `${service.typeName}/${method.name}`),
  ),
);

export function isPublicConnectPath(path: readonly string[]): boolean {
  // Next has already decoded each segment. Exact membership also rejects
  // encoded separators, traversal, unknown methods and extra path segments.
  return path.length === 2 && publicPaths.has(`${path[0]}/${path[1]}`);
}
