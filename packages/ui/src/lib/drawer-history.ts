type DrawerHistoryEntry = {
  id: string;
  onBack: () => void;
  isOpen: () => boolean;
};

const marker = "__sastDrawerHistory";
// A single sentinel lets nested drawers replace each other without extra page entries.
const entries = new Map<string, DrawerHistoryEntry>();
const handledEvents = new WeakSet<PopStateEvent>();
const cleanupWaiters = new Map<() => void, Set<string>>();
let sentinel: { token: string; url: string } | null = null;
let traversalPending = false;
let cleanupLocation: { url: string; state: Record<string, unknown> } | null =
  null;
let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function getMarker(state: unknown): unknown {
  return state && typeof state === "object" && marker in state
    ? (state as Record<string, unknown>)[marker]
    : undefined;
}

function scheduleReconcile() {
  clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(reconcile, 0);
}

function reconcile() {
  if (traversalPending) return;

  const openDrawers = [...entries.values()].filter((entry) => entry.isOpen());
  const hasOpenDrawer = openDrawers.length > 0;
  if (sentinel && getMarker(window.history.state) !== sentinel.token) {
    sentinel = null;
  }

  if (hasOpenDrawer && !sentinel) {
    const existingToken = getMarker(window.history.state);
    const token =
      typeof existingToken === "string" ? existingToken : crypto.randomUUID();
    sentinel = { token, url: window.location.href };
    if (typeof existingToken !== "string") {
      window.history.pushState(
        { ...window.history.state, [marker]: token },
        "",
        sentinel.url,
      );
    }
  } else if (!hasOpenDrawer && sentinel) {
    const state = { ...window.history.state };
    delete state[marker];
    cleanupLocation = { url: window.location.href, state };
    traversalPending = true;
    window.history.back();
  }
  if (!traversalPending) {
    cleanupWaiters.forEach((parents, resolve) => {
      if (openDrawers.every((entry) => parents.has(entry.id))) {
        cleanupWaiters.delete(resolve);
        resolve();
      }
    });
  }
}

function handlePopState(event: PopStateEvent) {
  if (traversalPending) {
    handledEvents.add(event);
    event.stopImmediatePropagation();
    traversalPending = false;
    sentinel = null;
    if (cleanupLocation) {
      window.history.replaceState(
        cleanupLocation.state,
        "",
        cleanupLocation.url,
      );
      cleanupLocation = null;
    }
    scheduleReconcile();
    return;
  }

  if (sentinel && getMarker(event.state) !== sentinel.token) {
    handledEvents.add(event);
    event.stopImmediatePropagation();
    sentinel = null;
    const top = [...entries.values()].reverse().find((entry) => entry.isOpen());
    top?.onBack();
    scheduleReconcile();
    return;
  }

  if (getMarker(event.state) && entries.size === 0) {
    handledEvents.add(event);
    event.stopImmediatePropagation();
    window.history.back();
  }
}

export function isDrawerHistoryPopState(event: PopStateEvent): boolean {
  return handledEvents.has(event);
}

export function waitForDrawerHistoryCleanup(): Promise<void> {
  return new Promise((resolve) => {
    // Capture in the close update's turn so a remaining parent isn't treated as the closing layer.
    const openDrawers = [...entries.values()].filter((entry) => entry.isOpen());
    cleanupWaiters.set(
      resolve,
      new Set(openDrawers.slice(0, -1).map((entry) => entry.id)),
    );
    scheduleReconcile();
  });
}

export function registerDrawerHistory(entry: DrawerHistoryEntry): () => void {
  if (!listening) {
    window.addEventListener("popstate", handlePopState, { capture: true });
    listening = true;
  }
  entries.set(entry.id, entry);
  scheduleReconcile();

  return () => {
    if (entries.get(entry.id) === entry) entries.delete(entry.id);
    scheduleReconcile();
  };
}
