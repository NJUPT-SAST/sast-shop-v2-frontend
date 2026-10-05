export interface ResourceSnapshot<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  updatedAt: number;
  revision: number;
}

interface ResourceEntry {
  snapshot: ResourceSnapshot<unknown>;
  listeners: Set<() => void>;
  pending?: Promise<void>;
  generation: number;
  lastUsed: number;
  invalidateOnWrite: boolean;
  sessionLifetime: boolean;
}

const entries = new Map<string, ResourceEntry>();
const emptySnapshot: ResourceSnapshot<never> = {
  data: undefined,
  error: null,
  loading: true,
  updatedAt: 0,
  revision: 0,
};
let listening = false;
let sessionPaused = false;

function entryFor(key: string): ResourceEntry {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("sast-shop:data-changed", () =>
      invalidateResources(),
    );
    const pauseSession = () => {
      sessionPaused = true;
      invalidateResources(true);
    };
    window.addEventListener("sast-shop:session-expired", pauseSession);
    window.addEventListener("sast-shop:session-changing", pauseSession);
    window.addEventListener("sast-shop:session-changed", clearResourceCache);
  }
  let entry = entries.get(key);
  if (!entry) {
    for (const [oldKey, oldEntry] of entries) {
      if (
        oldEntry.listeners.size === 0 &&
        !oldEntry.pending &&
        !oldEntry.sessionLifetime &&
        (entries.size >= 100 || Date.now() - oldEntry.lastUsed > 30 * 60_000)
      )
        entries.delete(oldKey);
    }
    entry = {
      snapshot: emptySnapshot,
      listeners: new Set(),
      generation: 0,
      lastUsed: Date.now(),
      invalidateOnWrite: true,
      sessionLifetime: false,
    };
    entries.set(key, entry);
  }
  entry.lastUsed = Date.now();
  return entry;
}

function publish(entry: ResourceEntry, snapshot: ResourceSnapshot<unknown>) {
  entry.snapshot = snapshot;
  entry.listeners.forEach((listener) => listener());
}

export function getResourceSnapshot<T>(key: string): ResourceSnapshot<T> {
  return entryFor(key).snapshot as ResourceSnapshot<T>;
}

export function getServerResourceSnapshot<T>(): ResourceSnapshot<T> {
  return emptySnapshot;
}

export function subscribeResource(key: string, listener: () => void) {
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function loadResource<T>(
  key: string,
  load: () => Promise<T>,
  staleTime: number,
  force = false,
  invalidateOnWrite = true,
): Promise<void> {
  const entry = entryFor(key);
  entry.invalidateOnWrite = invalidateOnWrite;
  entry.sessionLifetime = staleTime === Infinity && !invalidateOnWrite;
  if (sessionPaused) return Promise.resolve();
  if (entry.pending) return entry.pending;
  if (
    !force &&
    entry.snapshot.updatedAt > 0 &&
    Date.now() - entry.snapshot.updatedAt < staleTime
  ) {
    return Promise.resolve();
  }
  const generation = entry.generation;
  publish(entry, { ...entry.snapshot, loading: true, error: null });
  const pending = Promise.resolve()
    .then(load)
    .then(
      (data) => {
        if (entry.generation !== generation) return;
        publish(entry, {
          ...entry.snapshot,
          data,
          error: null,
          loading: false,
          updatedAt: Date.now(),
        });
      },
      (error: unknown) => {
        if (entry.generation !== generation) return;
        publish(entry, { ...entry.snapshot, error, loading: false });
      },
    )
    .finally(() => {
      if (entry.pending === pending) entry.pending = undefined;
    });
  entry.pending = pending;
  return pending;
}

function invalidateResources(clear = false) {
  for (const entry of entries.values()) {
    if (!clear && !entry.invalidateOnWrite) continue;
    entry.generation += 1;
    entry.pending = undefined;
    publish(entry, {
      ...(clear ? emptySnapshot : entry.snapshot),
      ...(sessionPaused
        ? { error: new Error("登录会话已失效，请重新登录"), loading: false }
        : {}),
      updatedAt: 0,
      revision: entry.snapshot.revision + 1,
    });
  }
}

export function clearResourceCache() {
  sessionPaused = false;
  invalidateResources(true);
}
