import { describe, expect, it } from "vitest";
import { isAdminConnectPath } from "./admin-connect-path";

describe("admin proxy allowlist", () => {
  it("allows only named management RPCs", () => {
    expect(
      isAdminConnectPath([
        "sast.sastshopv2.admin.v1.UserAdminService",
        "GetContext",
      ]),
    ).toBe(true);
    expect(
      isAdminConnectPath([
        "sast.sastshopv2.admin.v1.SpotAdminService",
        "ExecuteCorrection",
      ]),
    ).toBe(true);
  });
  it.each([
    ["sast.sastshopv2.admin.v1.SpotAdminService", "GetContext"],
    ["sast.sastshopv2.admin.v1.UserAdminService", "FutureMethod"],
    ["sast.sastshopv2.user.v1.UserService", "GetUserInfo"],
    ["sast.sastshopv2.admin.v1.UserAdminService", "GetContext", "extra"],
    ["sast.sastshopv2.admin.v1.UserAdminService/GetContext"],
  ])("rejects non-allowlisted path %j", (...path) => {
    expect(isAdminConnectPath(path)).toBe(false);
  });
});
