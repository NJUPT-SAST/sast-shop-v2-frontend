export const CONNECT_PROXY_TIMEOUT_MS = 15_000;

export function createConnectProxyAbort(
  requestSignal: AbortSignal,
  timeoutMs = CONNECT_PROXY_TIMEOUT_MS,
) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () =>
      timeoutController.abort(
        new DOMException("Upstream request timed out", "TimeoutError"),
      ),
    timeoutMs,
  );
  const signal = AbortSignal.any([requestSignal, timeoutController.signal]);

  return {
    signal,
    didTimeout: () => timeoutController.signal.aborted && !requestSignal.aborted,
    dispose: () => clearTimeout(timeout),
  };
}
