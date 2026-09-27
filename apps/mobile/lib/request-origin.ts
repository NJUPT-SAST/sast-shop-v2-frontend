import { isSameOriginRequest as checkSameOrigin } from "../../../config/request-origin";
import { mobileAppConfig } from "./app-config";

export function isSameOriginRequest(request: { headers: Headers }): boolean {
  return checkSameOrigin(request.headers, mobileAppConfig.appOrigin);
}
