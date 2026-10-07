import { describe, expect, it, vi } from "vitest";
import {
  rememberTemplateStoreId,
  resolveTemplateStoreId,
  TEMPLATE_STORE_STORAGE_KEY,
} from "./template-store-preference";

const stores = [{ id: "3001" }, { id: "3002" }];

describe("template store preference", () => {
  it("uses an explicit available store before the remembered store", () => {
    const getItem = vi.fn(() => "3002");
    expect(
      resolveTemplateStoreId(
        { stores, requestedStoreId: "3001", fallbackStoreId: "3001" },
        { getItem },
      ),
    ).toBe("3001");
    expect(getItem).not.toHaveBeenCalled();
  });

  it("restores the last selected available store", () => {
    expect(
      resolveTemplateStoreId(
        { stores, fallbackStoreId: "3001" },
        { getItem: () => "3002" },
      ),
    ).toBe("3002");
  });

  it.each([null, "9999"])(
    "ignores an unavailable remembered store %s",
    (value) => {
      expect(
        resolveTemplateStoreId(
          { stores, fallbackStoreId: "3001" },
          { getItem: () => value },
        ),
      ).toBe("3001");
    },
  );

  it("uses an available remembered store when the explicit store has disappeared", () => {
    expect(
      resolveTemplateStoreId(
        { stores, requestedStoreId: "9999", fallbackStoreId: "3001" },
        { getItem: () => "3002" },
      ),
    ).toBe("3002");
  });

  it("returns no selection without stores", () => {
    expect(
      resolveTemplateStoreId(
        { stores: [], fallbackStoreId: null },
        { getItem: () => "3002" },
      ),
    ).toBeNull();
  });

  it("falls back if storage reads fail", () => {
    expect(
      resolveTemplateStoreId(
        { stores, fallbackStoreId: "3001" },
        {
          getItem: () => {
            throw new Error("blocked");
          },
        },
      ),
    ).toBe("3001");
  });

  it("saves the selected store and tolerates storage write failures", () => {
    const setItem = vi.fn();
    expect(rememberTemplateStoreId("3002", { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(TEMPLATE_STORE_STORAGE_KEY, "3002");
    expect(
      rememberTemplateStoreId("3002", {
        setItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
  });
});
