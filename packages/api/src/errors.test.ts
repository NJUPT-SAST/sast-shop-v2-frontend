import { describe, expect, it } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "./errors";

describe("api errors", () => {
  it("names typed API errors consistently", () => {
    expect(new FeatureUnavailableError("profile").name).toBe(
      "FeatureUnavailableError",
    );
    expect(new ApiRequestError("profile").name).toBe("ApiRequestError");
    expect(new ApiConfigurationError("NEXT_PUBLIC_CONNECT_BASE_URL").name).toBe(
      "ApiConfigurationError",
    );
    expect(new ValidationError("收件人不能为空").name).toBe("ValidationError");
  });

  it("keeps validation messages user-readable", () => {
    expect(new ValidationError("手机号格式不正确").message).toBe(
      "手机号格式不正确",
    );
  });
});
