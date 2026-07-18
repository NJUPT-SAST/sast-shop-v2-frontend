import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors";
import {
  createErrandDemand,
  getErrandDemandDetails,
  listErrandDemandStores,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
  type ErrandDemandDetailGroup,
  type ErrandDemandStoreSummary,
} from "./errand-demands";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

const validInput: CreateErrandDemandInput = {
  storeId: "3001",
  deadline: "2026-06-09T14:00:00.000Z",
  items: [
    {
      productTemplateId: "1001",
      quantity: 2,
      serviceFeePerUnitCents: 300,
      updatedAt: "2026-06-09T13:00:00.000Z",
    },
    {
      productTemplateId: "1002",
      quantity: 1,
      serviceFeePerUnitCents: 100,
      updatedAt: null,
    },
  ],
};

describe("errand demand service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a stable create errand demand return type", () => {
    expectTypeOf<ReturnType<typeof createErrandDemand>>().toEqualTypeOf<
      Promise<CreateErrandDemandResult>
    >();
  });

  it("exposes stable captain demand return types", () => {
    expectTypeOf<ReturnType<typeof listErrandDemandStores>>().toEqualTypeOf<
      Promise<ErrandDemandStoreSummary[]>
    >();
    expectTypeOf<ReturnType<typeof getErrandDemandDetails>>().toEqualTypeOf<
      Promise<ErrandDemandDetailGroup[]>
    >();
  });

  it("creates errand demands through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandDemandId: "9001",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createErrandDemand(validInput, localOptions);

    expect(result).toEqual({ errandDemandId: "9001" });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandDemandService/CreateErrandDemand",
      body: {
        storeId: "3001",
        deadline: "2026-06-09T14:00:00Z",
        demandItems: [
          {
            productTemplateId: "1001",
            quantity: 2,
            serviceFeePerUnitCents: 300,
            updatedAt: "2026-06-09T13:00:00Z",
          },
          {
            productTemplateId: "1002",
            quantity: 1,
            serviceFeePerUnitCents: 100,
          },
        ],
      },
    });
  });

  it("validates create errand demand input before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createErrandDemand({ ...validInput, storeId: "0" }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        { ...validInput, storeId: "9223372036854775808" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        { ...validInput, deadline: "not-a-date" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand({ ...validInput, items: [] }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0], quantity: 0 }],
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [
            {
              ...validInput.items[0],
              productTemplateId: "9223372036854775808",
            },
          ],
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0], serviceFeePerUnitCents: -1 }],
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists open errand demand stores through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        demands: [
          {
            storeId: "3001",
            storeName: "SAST 小卖部",
            participantAvatars: [
              "https://example.test/avatar/a.png",
              "https://example.test/avatar/b.png",
            ],
            totalOriginUnitPriceCents: 4200,
            totalServiceFeeCents: 800,
            updatedAt: "1970-01-01T00:00:04Z",
          },
        ],
        currentPage: 1,
        totalCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const demands = await listErrandDemandStores({
      ...localOptions,
      storeName: "SAST",
      page: 1,
      pageSize: 20,
    });

    expect(demands).toEqual([
      {
        storeId: "3001",
        storeName: "SAST 小卖部",
        participantAvatars: [
          "https://example.test/avatar/a.png",
          "https://example.test/avatar/b.png",
        ],
        totalOriginUnitPriceCents: 4200,
        totalServiceFeeCents: 800,
        updatedAt: "1970-01-01T00:00:04.000Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandList",
      body: {
        page: 1,
        pageSize: 20,
        storeName: "SAST",
      },
    });
  });

  it("gets errand demand details through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        details: [
          {
            errandDemandId: "9001",
            productTemplate: {
              id: "4001",
              title: "农夫山泉矿泉水",
              description: "550ml 瓶装水",
              priceCents: 200,
              storeId: "3001",
              mainImageUrl: "https://example.test/water.png",
              barcode: "690000000001",
              updatedAt: "1970-01-01T00:00:03Z",
            },
            estimatedUnitPriceCents: 200,
            quantity: 12,
            requesters: [
              {
                requesterId: "1001",
                requesterName: "李同学",
                requesterAvatarUrl: "https://example.test/avatar/li.png",
                quantity: 6,
                serviceFeePerUnitCents: 50,
                errandDemandItemId: "9101",
                deadline: "1970-01-01T02:00:00Z",
                updatedAt: "1970-01-01T00:00:05Z",
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const details = await getErrandDemandDetails(
      { storeId: "3001" },
      localOptions,
    );

    expect(details).toEqual([
      {
        errandDemandId: "9001",
        estimatedUnitPriceCents: 200,
        quantity: 12,
        productTemplate: {
          id: "4001",
          title: "农夫山泉矿泉水",
          description: "550ml 瓶装水",
          priceCents: 200,
          storeId: "3001",
          mainImageUrl: "https://example.test/water.png",
          barcode: "690000000001",
          updatedAt: "1970-01-01T00:00:03.000Z",
        },
        requesters: [
          {
            requesterId: "1001",
            requesterName: "李同学",
            requesterAvatarUrl: "https://example.test/avatar/li.png",
            quantity: 6,
            serviceFeePerUnitCents: 50,
            errandDemandItemId: "9101",
            deadline: "1970-01-01T02:00:00.000Z",
            updatedAt: "1970-01-01T00:00:05.000Z",
          },
        ],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandDetail",
      body: {
        storeId: "3001",
      },
    });
  });

  it("rejects demand groups whose product snapshot is unavailable", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        details: [
          {
            errandDemandId: "9001",
            estimatedUnitPriceCents: 200,
            quantity: 12,
            requesters: [],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getErrandDemandDetails({ storeId: "3001" }, localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "local" }),
    ).rejects.toBeInstanceOf(ApiConfigurationError);
  });

  it("wraps local create failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          {
            code: "unavailable",
            message: "backend unavailable",
          },
          { status: 503 },
        ),
      ),
    );

    await expect(
      createErrandDemand(validInput, localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });
});

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string;
    body: Record<string, unknown>;
  },
) {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  return String(body);
}
