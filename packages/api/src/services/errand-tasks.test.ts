import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FeatureUnavailableError, ValidationError } from "../errors";
import {
  cancelTask,
  getCollectingPaymentDetail,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail,
  listErrandTasks,
  listErrandTasksPage,
  saveDistributingAssignment,
  saveShoppingTaskItem,
  transitionToCollectingPayment,
  transitionToCompleted,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
  type ErrandTaskBrief,
  type ErrandTaskStatusFilter,
} from "./errand-tasks";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("listErrandTasks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns typed errand task briefs", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [
          {
            taskId: "7001",
            storeId: "3001",
            storeName: "SAST 小卖部",
            status: "ERRAND_TASK_STATUS_SHOPPING",
            items: [
              { id: "7101", updatedAt: "2026-07-18T02:00:00Z" },
              { id: "7102" },
            ],
            updatedAt: "2026-06-09T08:31:00Z",
            createdAt: "2026-06-09T08:30:00Z",
          },
        ],
        currentPage: 2,
        totalCount: 21,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expectTypeOf<ReturnType<typeof listErrandTasks>>().toEqualTypeOf<
      Promise<ErrandTaskBrief[]>
    >();
    expectTypeOf<ReturnType<typeof listErrandTasksPage>>().toEqualTypeOf<
      Promise<import("../pagination").PageResult<ErrandTaskBrief>>
    >();

    const tasks = await listErrandTasks({
      ...localOptions,
      status: "shopping",
      page: 2,
      pageSize: 20,
    });

    expect(tasks).toEqual([
      {
        id: "7001",
        storeId: "3001",
        storeName: "SAST 小卖部",
        status: "shopping",
        itemCount: 2,
        items: [
          { id: "7101", updatedAt: "2026-07-18T02:00:00.000Z" },
          { id: "7102", updatedAt: null },
        ],
        updatedAt: "2026-06-09T08:31:00.000Z",
        createdAt: "2026-06-09T08:30:00.000Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: {
        page: 2,
        pageSize: 20,
        filterStatus: "ERRAND_TASK_STATUS_SHOPPING",
      },
    });
  });

  it("preserves errand task page metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          errandTasks: [],
          currentPage: 1,
          totalCount: 51,
        }),
      ),
    );

    await expect(
      listErrandTasksPage({ ...localOptions, page: 1, pageSize: 50 }),
    ).resolves.toEqual({
      items: [],
      currentPage: 1,
      pageSize: 50,
      totalCount: 51,
      hasMore: true,
    });
  });

  it("does not use task creation time as an update concurrency token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [],
              createdAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        }),
      ),
    );

    await expect(listErrandTasks(localOptions)).resolves.toEqual([
      {
        id: "7002",
        storeId: "3001",
        storeName: "SAST 小卖部",
        status: "pending_distributing",
        itemCount: 0,
        items: [],
        updatedAt: null,
        createdAt: "2026-07-17T08:00:00.000Z",
      },
    ]);
  });

  it("reads raw proto-name task timestamps for concurrency tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          errand_tasks: [
            {
              task_id: "7002",
              store_id: "3001",
              store_name: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [],
              updated_at: "2026-07-17T08:00:00Z",
              created_at: "2026-07-17T07:59:00Z",
            },
          ],
          current_page: 1,
          total_count: 1,
        }),
      ),
    );

    await expect(
      getErrandTaskBrief("7002", localOptions),
    ).resolves.toMatchObject({
      id: "7002",
      updatedAt: "2026-07-17T08:00:00.000Z",
    });
  });

  it("accepts valid status filters", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [],
        currentPage: 1,
        totalCount: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const status: ErrandTaskStatusFilter = "shopping";

    await expect(listErrandTasks({ ...localOptions, status })).resolves.toEqual(
      [],
    );
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: {
        page: 1,
        pageSize: 50,
        filterStatus: "ERRAND_TASK_STATUS_SHOPPING",
      },
    });
  });

  it("rejects invalid pagination", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listErrandTasks({ ...localOptions, page: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      listErrandTasks({ ...localOptions, pageSize: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps remote explicitly unavailable", async () => {
    await expect(
      listErrandTasks({ dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("finds a task beyond the first page", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      return stubJsonResponse(
        callCount === 1
          ? {
              errandTasks: [],
              currentPage: 1,
              totalCount: 51,
            }
          : {
              errandTasks: [
                {
                  taskId: "7051",
                  storeId: "3001",
                  storeName: "SAST 小卖部",
                  status: "ERRAND_TASK_STATUS_COMPLETED",
                  items: [],
                },
              ],
              currentPage: 2,
              totalCount: 51,
            },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getErrandTaskBrief("7051", localOptions),
    ).resolves.toMatchObject({
      id: "7051",
      status: "completed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: { page: 2, pageSize: 50 },
    });
  });
});

describe("captain task detail facades", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps shopping detail and preserves optional purchase state", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTaskId: "7001",
        storeId: "3001",
        storeName: "SAST 小卖部",
        taskItems: [
          {
            id: "7101",
            productSnapshot: {
              title: "矿泉水",
              description: "550ml",
              mainImageUrl: "https://example.test/water.png",
              barcode: "690000000001",
            },
            requiredQuantity: 12,
            purchasedQuantity: -1,
            actualUnitPriceCents: 200,
            updatedAt: "2026-07-18T02:00:00Z",
          },
          {
            id: "7102",
            productSnapshot: { title: "三明治" },
            requiredQuantity: 4,
            purchasedQuantity: 0,
            nonPurchaseReason: "缺货",
            actualUnitPriceCents: 1100,
          },
        ],
        updatedAt: "2026-07-18T03:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShoppingTaskDetail("7001", localOptions)).resolves.toEqual({
      taskId: "7001",
      storeId: "3001",
      taskUpdatedAt: "2026-07-18T03:00:00.000Z",
      storeName: "SAST 小卖部",
      taskItems: [
        {
          id: "7101",
          productTitle: "矿泉水",
          productDescription: "550ml",
          productImageUrl: "https://example.test/water.png",
          productBarcode: "690000000001",
          requiredQuantity: 12,
          purchasedQuantity: null,
          nonPurchaseReason: null,
          actualUnitPriceCents: 200,
          updatedAt: "2026-07-18T02:00:00.000Z",
          deadline: null,
        },
        {
          id: "7102",
          productTitle: "三明治",
          productDescription: "",
          productImageUrl: "",
          productBarcode: "",
          requiredQuantity: 4,
          purchasedQuantity: 0,
          nonPurchaseReason: "缺货",
          actualUnitPriceCents: 1100,
          updatedAt: null,
          deadline: null,
        },
      ],
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetShoppingTaskDetail",
      body: { errandTaskId: "7001" },
    });
  });

  it("maps distributing detail with requester concurrency fields", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [{ id: "7201", updatedAt: "2026-07-18T02:00:00Z" }],
              updatedAt: "2026-07-17T08:00:00Z",
              createdAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({
        errandTaskId: "7002",
        storeId: "3001",
        storeName: "SAST 小卖部",
        packagingFeeCents: 300,
        distributingItems: [
          {
            errandTaskItemId: "7201",
            titleSnapshot: "矿泉水",
            descriptionSnapshot: "550ml",
            imageUrlSnapshot: "https://example.test/water.png",
            originUnitPriceCents: 200,
            actualUnitPriceCents: 180,
            requesters: [
              {
                purchaserId: "1001",
                purchaserName: "李同学",
                purchaserAvatarUrl: "https://example.test/li.png",
                quantity: 6,
                distributedQuantity: 0,
                errandTaskAssignmentId: "8201",
                errandDemandItemId: "6101",
                errandTaskAssignmentUpdatedAt: "2026-07-17T08:00:00Z",
              },
            ],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getDistributingTaskDetail("7002", localOptions);

    expect(detail).toMatchObject({
      taskId: "7002",
      storeId: "3001",
      taskUpdatedAt: "2026-07-17T08:00:00.000Z",
      packagingFeeCents: 300,
      items: [
        {
          errandTaskItemId: "7201",
          actualUnitPriceCents: 180,
          itemUpdatedAt: "2026-07-18T02:00:00.000Z",
          requesters: [
            {
              purchaserId: "1001",
              errandTaskAssignmentId: "8201",
              errandDemandItemId: "6101",
              assignmentUpdatedAt: "2026-07-17T08:00:00.000Z",
            },
          ],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: { page: 1, pageSize: 50 },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetDistributingTaskDetail",
      body: { errandTaskId: "7002" },
    });
  });

  it("uses raw distributing detail timestamp when brief timestamp is missing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [],
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({
        errandTaskId: "7002",
        storeId: "3001",
        storeName: "SAST 小卖部",
        updated_at: "2026-07-17T08:00:00Z",
        packagingFeeCents: 300,
        distributingItems: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getDistributingTaskDetail("7002", {
      ...localOptions,
      taskItems: [],
      taskUpdatedAt: null,
    });

    expect(detail.taskUpdatedAt).toBe("2026-07-17T08:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses provided task item timestamps for distributing detail", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTaskId: "7002",
        storeId: "3001",
        storeName: "SAST 小卖部",
        packagingFeeCents: 300,
        distributingItems: [
          {
            errandTaskItemId: "7201",
            titleSnapshot: "矿泉水",
            descriptionSnapshot: "550ml",
            imageUrlSnapshot: "https://example.test/water.png",
            originUnitPriceCents: 200,
            actualUnitPriceCents: 180,
            requesters: [],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getDistributingTaskDetail("7002", {
      ...localOptions,
      taskUpdatedAt: "2026-07-17T08:00:00.000Z",
      taskItems: [{ id: "7201", updatedAt: "2026-07-18T02:00:00.000Z" }],
    });

    expect(detail.taskUpdatedAt).toBe("2026-07-17T08:00:00.000Z");
    expect(detail.items[0]?.itemUpdatedAt).toBe("2026-07-18T02:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetDistributingTaskDetail",
      body: { errandTaskId: "7002" },
    });
  });

  it("maps collecting-payment bills and explainable amount fields", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        bills: [
          {
            requesterId: "1001",
            requesterName: "李同学",
            requesterAvatarUrl: "https://example.test/li.png",
            paymentStatus: "BILL_STATUS_SUBMITTED",
            bill: {
              id: "9001",
              billNo: "ER-001",
              channel: "CHANNEL_WECHAT",
              serialNumber: "WX-20260718-001",
              verifyCode: "4821",
              updatedAt: "2026-07-18T02:00:00Z",
            },
            items: [
              {
                errandDemandItemId: "6101",
                titleSnapshot: "矿泉水",
                requiredQuantity: 6,
                purchasedQuantity: 6,
                distributedQuantity: 6,
                actualUnitPriceCents: 200,
                productAmountCents: 1200,
                serviceFeePerUnitCents: 25,
                serviceFeeAmountCents: 150,
                packagingFeeShareCents: 150,
                subtotalCents: 1500,
              },
            ],
            productAmountCents: 1200,
            serviceFeeAmountCents: 150,
            packagingFeeShareCents: 150,
            totalAmountCents: 1500,
          },
        ],
        updated_at: "2026-07-16T08:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getCollectingPaymentDetail("7004", localOptions);

    expect(detail).toEqual({
      taskId: "7004",
      taskUpdatedAt: "2026-07-16T08:00:00.000Z",
      bills: [
        {
          requesterId: "1001",
          requesterName: "李同学",
          requesterAvatarUrl: "https://example.test/li.png",
          paymentStatus: "pending_confirmation",
          billId: "9001",
          billNo: "ER-001",
          billUpdatedAt: "2026-07-18T02:00:00.000Z",
          paymentChannel: "wechat",
          serialNumber: "WX-20260718-001",
          verifyCode: "4821",
          items: [
            {
              errandDemandItemId: "6101",
              title: "矿泉水",
              requiredQuantity: 6,
              purchasedQuantity: 6,
              distributedQuantity: 6,
              actualUnitPriceCents: 200,
              productAmountCents: 1200,
              serviceFeePerUnitCents: 25,
              serviceFeeAmountCents: 150,
              packagingFeeShareCents: 150,
              subtotalCents: 1500,
              nonPurchaseReason: null,
            },
          ],
          productAmountCents: 1200,
          serviceFeeAmountCents: 150,
          packagingFeeShareCents: 150,
          totalAmountCents: 1500,
        },
      ],
    });
  });

  it("maps closed bills to an explicit terminal state", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        bills: [
          {
            requesterId: "1002",
            requesterName: "王同学",
            paymentStatus: "BILL_STATUS_CLOSED",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getCollectingPaymentDetail("7004", localOptions);

    expect(detail.bills[0]?.paymentStatus).toBe("closed");
  });

  it("sends purchase mutations with optimistic concurrency timestamps", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await saveShoppingTaskItem(
      {
        errandTaskId: "7001",
        errandTaskItemId: "7101",
        purchasedQuantity: 8,
        itemUpdatedAt: "2026-07-18T02:00:00Z",
      },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/SaveShoppingTaskItem",
      body: {
        errandTaskId: "7001",
        errandTaskItemId: "7101",
        purchasedQuantity: 8,
        errandTaskItemUpdatedAt: "2026-07-18T02:00:00Z",
      },
    });
  });

  it("sends the purchase revoke sentinel with item concurrency timestamp", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await saveShoppingTaskItem(
      {
        errandTaskId: "9",
        errandTaskItemId: "10",
        purchasedQuantity: -1,
        nonPurchaseReason: null,
        itemUpdatedAt: "2026-07-26T11:13:36.382Z",
      },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/SaveShoppingTaskItem",
      body: {
        errandTaskId: "9",
        errandTaskItemId: "10",
        purchasedQuantity: -1,
        errandTaskItemUpdatedAt: "2026-07-26T11:13:36.382Z",
      },
    });
  });

  it("sends actual price updates with the previous item timestamp", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await updateActualPrice(
      {
        errandTaskId: "7002",
        errandTaskItemId: "7201",
        actualUnitPriceCents: 180,
        itemUpdatedAt: "2026-07-18T02:00:00Z",
      },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/UpdateActualPrice",
      body: {
        errandTaskId: "7002",
        errandTaskItemId: "7201",
        actualUnitPriceCents: 180,
        errandTaskItemUpdatedAt: "2026-07-18T02:00:00Z",
      },
    });
  });

  it("auto-resolves item timestamp for actual price updates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [{ id: "7201", updatedAt: "2026-07-18T02:00:00Z" }],
              updatedAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateActualPrice(
      {
        errandTaskId: "7002",
        errandTaskItemId: "7201",
        actualUnitPriceCents: 180,
      },
      localOptions,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: { page: 1, pageSize: 50 },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/UpdateActualPrice",
      body: {
        errandTaskId: "7002",
        errandTaskItemId: "7201",
        actualUnitPriceCents: 180,
        errandTaskItemUpdatedAt: "2026-07-18T02:00:00Z",
      },
    });
  });

  it("requires an item timestamp for actual price updates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateActualPrice(
        {
          errandTaskId: "7002",
          errandTaskItemId: "7201",
          actualUnitPriceCents: 180,
          itemUpdatedAt: "",
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses -1 to restore purchase and distribution rows to unprocessed", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await saveShoppingTaskItem(
      {
        errandTaskId: "7001",
        errandTaskItemId: "7101",
        purchasedQuantity: -1,
      },
      localOptions,
    );
    await saveDistributingAssignment(
      {
        errandTaskItemId: "7101",
        errandTaskAssignmentId: "8101",
        distributedQuantity: -1,
      },
      localOptions,
    );

    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/SaveShoppingTaskItem",
      body: {
        errandTaskId: "7001",
        errandTaskItemId: "7101",
        purchasedQuantity: -1,
      },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/SaveDistributingTaskAssignment",
      body: {
        errandTaskItemId: "7101",
        errandTaskAssignmentId: "8101",
        distributedQuantity: -1,
      },
    });
  });

  it("returns the new distributing assignment timestamp", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTaskAssignmentUpdatedAt: "2026-07-17T08:05:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveDistributingAssignment(
        {
          errandTaskItemId: "7101",
          errandTaskAssignmentId: "8101",
          distributedQuantity: 3,
          assignmentUpdatedAt: "2026-07-17T08:00:00Z",
        },
        localOptions,
      ),
    ).resolves.toEqual({
      assignmentUpdatedAt: "2026-07-17T08:05:00.000Z",
    });

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/SaveDistributingTaskAssignment",
      body: {
        errandTaskItemId: "7101",
        errandTaskAssignmentId: "8101",
        distributedQuantity: 3,
        errandTaskAssignmentUpdatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("rejects operation quantities below the unprocessed sentinel", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveShoppingTaskItem(
        {
          errandTaskId: "7001",
          errandTaskItemId: "7101",
          purchasedQuantity: -2,
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      saveDistributingAssignment(
        {
          errandTaskItemId: "7101",
          errandTaskAssignmentId: "8101",
          distributedQuantity: -2,
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects overflowing monetary fields before a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateActualPrice(
        {
          errandTaskId: "7001",
          errandTaskItemId: "7101",
          actualUnitPriceCents: 2_147_483_648,
          itemUpdatedAt: "2026-07-18T02:00:00Z",
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      transitionToDistributing(
        "7001",
        2_147_483_648,
        "2026-07-18T02:00:00Z",
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends transition-to-distributing with the previous task timestamp", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await transitionToDistributing(
      "7002",
      300,
      "2026-07-17T08:00:00Z",
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToDistributing",
      body: {
        errandTaskId: "7002",
        packagingFeeCents: 300,
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("auto-resolves task timestamp for transition-to-distributing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
              items: [],
              updatedAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await transitionToDistributing("7002", 300, null, localOptions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: { page: 1, pageSize: 50 },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToDistributing",
      body: {
        errandTaskId: "7002",
        packagingFeeCents: 300,
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("requires a resolved task timestamp for transition-to-distributing", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [
          {
            taskId: "7002",
            storeId: "3001",
            storeName: "SAST 小卖部",
            status: "ERRAND_TASK_STATUS_PENDING_DISTRIBUTING",
            items: [],
          },
        ],
        currentPage: 1,
        totalCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transitionToDistributing("7002", 300, null, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends transition-to-collecting-payment with the previous task timestamp", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await transitionToCollectingPayment(
      "7002",
      "2026-07-17T08:00:00Z",
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToCollectingPayment",
      body: {
        errandTaskId: "7002",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("auto-resolves task timestamp for transition-to-collecting-payment", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7002",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_DISTRIBUTING",
              items: [],
              updatedAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await transitionToCollectingPayment("7002", null, localOptions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: { page: 1, pageSize: 50 },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToCollectingPayment",
      body: {
        errandTaskId: "7002",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("requires a resolved task timestamp for transition-to-collecting-payment", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [
          {
            taskId: "7002",
            storeId: "3001",
            storeName: "SAST 小卖部",
            status: "ERRAND_TASK_STATUS_DISTRIBUTING",
            items: [],
          },
        ],
        currentPage: 1,
        totalCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transitionToCollectingPayment("7002", null, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses task timestamps for final transition and cancel endpoints", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await transitionToPendingDistributing(
      "7001",
      "2026-07-17T08:00:00Z",
      localOptions,
    );
    await transitionToCompleted("7001", "2026-07-17T08:00:00Z", localOptions);
    await cancelTask("7001", "2026-07-17T08:00:00Z", localOptions);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToPendingDistributing",
      body: {
        errandTaskId: "7001",
      },
    });
    await expectConnectRequestAt(fetchMock, 1, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToCompleted",
      body: {
        errandTaskId: "7001",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
    await expectConnectRequestAt(fetchMock, 2, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/CancelTask",
      body: {
        errandTaskId: "7001",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("auto-resolves task timestamps for task-level mutations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;

      if (path.endsWith("/GetErrandTaskList")) {
        return stubJsonResponse({
          errandTasks: [
            {
              taskId: "7001",
              storeId: "3001",
              storeName: "SAST 小卖部",
              status: "ERRAND_TASK_STATUS_SHOPPING",
              items: [],
              updatedAt: "2026-07-17T08:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await transitionToPendingDistributing("7001", null, localOptions);
    await transitionToCompleted("7001", null, localOptions);
    await cancelTask("7001", null, localOptions);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    await expectConnectRequestAt(fetchMock, 0, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToPendingDistributing",
      body: {
        errandTaskId: "7001",
      },
    });
    await expectConnectRequestAt(fetchMock, 2, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/TransitionToCompleted",
      body: {
        errandTaskId: "7001",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
    await expectConnectRequestAt(fetchMock, 4, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/CancelTask",
      body: {
        errandTaskId: "7001",
        updatedAt: "2026-07-17T08:00:00Z",
      },
    });
  });

  it("rejects invalid and overflowing task ids before a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getShoppingTaskDetail("0", localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      getShoppingTaskDetail("9223372036854775808", localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
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
  await expectConnectRequestAt(fetchMock, 0, expected);
}

async function expectConnectRequestAt(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
  expected: {
    path: string;
    body: Record<string, unknown>;
  },
) {
  const [input, init] = fetchMock.mock.calls[index] ?? [];
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
