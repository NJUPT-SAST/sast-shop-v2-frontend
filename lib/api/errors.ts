// Centralized error type for the API layer.
// All non-2xx responses are normalised into ApiError so call sites only
// need to handle one shape (vs. mixing fetch TypeError + JSON parsing failures
// + business error envelopes).

export type ApiErrorBody = {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
  request_id?: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>
  readonly requestId?: string

  constructor(body: ApiErrorBody) {
    super(body.message || body.code || `HTTP ${body.status}`)
    this.name = "ApiError"
    this.code = body.code || `HTTP_${body.status}`
    this.status = body.status
    this.details = body.details
    this.requestId = body.request_id
  }

  is(code: string): boolean {
    return this.code === code
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
