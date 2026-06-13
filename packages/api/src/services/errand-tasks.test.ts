import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { FeatureUnavailableError, ValidationError } from "../errors"
import {
  listErrandTasks,
  type ErrandTaskBrief,
  type ErrandTaskStatusFilter,
} from "./errand-tasks"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

describe("listErrandTasks", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns typed errand task briefs", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [
          {
            taskId: "7001",
            storeId: "3001",
            storeName: "SAST 小卖部",
            status: "ERRAND_TASK_STATUS_SHOPPING",
            items: [{ id: "7101" }, { id: "7102" }],
            createdAt: "2026-06-09T08:30:00Z",
          },
        ],
        currentPage: 1,
        totalCount: 1,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    expectTypeOf<ReturnType<typeof listErrandTasks>>().toEqualTypeOf<
      Promise<ErrandTaskBrief[]>
    >()

    const tasks = await listErrandTasks({
      ...localOptions,
      status: "shopping",
      page: 2,
      pageSize: 20,
    })

    expect(tasks).toEqual([
      {
        id: "7001",
        storeId: "3001",
        storeName: "SAST 小卖部",
        status: "shopping",
        itemCount: 2,
        createdAt: "2026-06-09T08:30:00.000Z",
      },
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: {
        page: 2,
        pageSize: 20,
        filterStatus: "ERRAND_TASK_STATUS_SHOPPING",
      },
    })
  })

  it("accepts valid status filters", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [],
        currentPage: 1,
        totalCount: 0,
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const status: ErrandTaskStatusFilter = "shopping"

    await expect(listErrandTasks({ ...localOptions, status })).resolves.toEqual([])
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
      body: {
        page: 1,
        pageSize: 50,
        filterStatus: "ERRAND_TASK_STATUS_SHOPPING",
      },
    })
  })

  it("rejects invalid pagination", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listErrandTasks({ ...localOptions, page: 0 })
    ).rejects.toBeInstanceOf(ValidationError)

    await expect(
      listErrandTasks({ ...localOptions, pageSize: 0 })
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps remote explicitly unavailable", async () => {
    await expect(listErrandTasks({ dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
  })
})

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  })
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string
    body: Record<string, unknown>
  }
) {
  const [input, init] = fetchMock.mock.calls[0] ?? []
  const url = typeof input === "string" ? input : (input as Request).url
  const body =
    typeof input === "string" ? init?.body : await (input as Request).clone().text()

  expect(new URL(url).pathname).toBe(expected.path)
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body)
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body)
  }

  return String(body)
}
