import { describe, expect, it } from "vitest";

import { CatalogInternalService } from "../gen/sast/sastshopv2/catalog/v1/catalog_internal_pb";
import { ProductTemplateService } from "../gen/sast/sastshopv2/catalog/v1/product_template_service_pb";
import { CatalogService } from "../gen/sast/sastshopv2/catalog/v1/store_service_pb";
import { BuyerErrandOrderService } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_service_pb";
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb";
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb";
import { GroupTradeInternalService } from "../gen/sast/sastshopv2/errand/v1/grouptrade_internal_pb";
import { BillService } from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { PaymentInternalService } from "../gen/sast/sastshopv2/payment/v1/payment_internal_pb";
import { QrCodeService } from "../gen/sast/sastshopv2/payment/v1/qr_code_service_pb";
import { SpotGoodsService } from "../gen/sast/sastshopv2/spot/v1/spot_goods_service_pb";
import { SpotOrderService } from "../gen/sast/sastshopv2/spot/v1/spot_order_service_pb";
import { AddressService } from "../gen/sast/sastshopv2/user/v1/address_service_pb";
import { AuthService } from "../gen/sast/sastshopv2/user/v1/auth_service_pb";
import { UserInternalService } from "../gen/sast/sastshopv2/user/v1/user_service_internal_pb";
import { UserService } from "../gen/sast/sastshopv2/user/v1/user_service_pb";
import { FaceProfileService, WestPocketService, WestPocketInternalService } from "../gen/sast/sastshopv2/westpocket/v1/west_pocket_pb";
import { isPublicConnectPath } from "./public-connect-path";

describe("public Connect routes", () => {
  it.each([
    CatalogService,
    ProductTemplateService,
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
  ])("preserves every public method on $typeName", (service) => {
    for (const method of service.methods) {
      expect(isPublicConnectPath([service.typeName, method.name])).toBe(true);
    }
  });

  it.each([
    CatalogInternalService,
    GroupTradeInternalService,
    PaymentInternalService,
    UserInternalService,
    WestPocketInternalService,
    AuthService,
  ])("excludes every server-only method on $typeName", (service) => {
    for (const method of service.methods) {
      expect(isPublicConnectPath([service.typeName, method.name])).toBe(false);
    }
  });

  it.each([
    { path: [] },
    { path: [BillService.typeName] },
    { path: [BillService.typeName, "GetBill", ""] },
    { path: [BillService.typeName, "GetBill/"] },
    { path: [BillService.typeName, "GetBill%2f"] },
    { path: [BillService.typeName, "GetBill%252f"] },
    { path: [BillService.typeName, "GetBill\\"] },
    { path: [BillService.typeName, "getBill"] },
    { path: [BillService.typeName, "UnknownMethod"] },
    { path: ["UnknownService", "GetBill"] },
    { path: ["..", "health"] },
    { path: [BillService.typeName, "GetBill?method=CancelBillBySource"] },
  ])("rejects noncanonical or unknown route $path", ({ path }) => {
    expect(isPublicConnectPath(path)).toBe(false);
  });
});
