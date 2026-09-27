import {
  hasExpectedRequestHost as checkRequestHost,
  isSameOriginRequest as checkSameOrigin,
} from "../../../config/request-origin";
import { desktopAppConfig } from "./app-config";

export function hasExpectedRequestHost(request: { headers: Headers }): boolean {
  return checkRequestHost(request.headers, desktopAppConfig.appOrigin);
}

export function isSameOriginRequest(request: { headers: Headers }): boolean {
  return checkSameOrigin(request.headers, desktopAppConfig.appOrigin);
}
