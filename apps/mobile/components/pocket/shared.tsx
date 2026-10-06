"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ServiceOptions, PocketJob, PocketUser } from "@sast-shop/api";
import { RiInformationLine, RiUser3Line } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { LoadFailure } from "../load-failure";
import { useTransactionAgreement } from "../transaction-agreement-provider";
import { pocketError, pocketJobLabel, pocketJobError } from "@/lib/pocket";

const PocketContext = createContext<ServiceOptions>({});
export function PocketProvider({
  options,
  children,
}: {
  options: ServiceOptions;
  children: ReactNode;
}) {
  return (
    <PocketContext.Provider value={options}>{children}</PocketContext.Provider>
  );
}
export function usePocketOptions() {
  return useContext(PocketContext);
}

export function usePocketResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  const mounted = useRef(false);
  const inFlight = useRef<{
    load: () => Promise<T>;
    promise: Promise<T | null>;
    epoch: number;
  } | null>(null);
  const fetchResource = useCallback(
    (fresh = false): Promise<T | null> => {
      if (!fresh && inFlight.current?.load === load)
        return inFlight.current.promise;
      const requestEpoch = ++epoch.current;
      const promise = (async () => {
        try {
          const result = await Promise.resolve().then(load);
          if (!mounted.current || requestEpoch !== epoch.current) return null;
          setData(result);
          setError("");
          return result;
        } catch (reason) {
          if (mounted.current && requestEpoch === epoch.current)
            setError(pocketError(reason));
          return null;
        } finally {
          if (inFlight.current?.epoch === requestEpoch) inFlight.current = null;
        }
      })();
      inFlight.current = { load, promise, epoch: requestEpoch };
      return promise;
    },
    [load],
  );
  const refresh = useCallback(() => fetchResource(), [fetchResource]);
  const refreshFresh = useCallback(() => fetchResource(true), [fetchResource]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      inFlight.current = null;
    };
  }, [refresh]);
  const replaceData = useCallback((value: T) => {
    epoch.current++;
    inFlight.current = null;
    setData(value);
    setError("");
  }, []);
  return { data, setData: replaceData, error, refresh, refreshFresh };
}

interface PocketActionOptions {
  transaction?: boolean;
  reconcile?: () => Promise<boolean>;
}

export function usePocketAction(defaults: PocketActionOptions = {}) {
  const { ensureAgreement } = useTransactionAgreement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const requests = useRef(new Map<string, string>());
  const recovery = useRef<(() => Promise<boolean>) | null>(null);
  const recoveryRunning = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const recover = async () => {
    if (!recovery.current || recoveryRunning.current) return;
    recoveryRunning.current = true;
    try {
      if (!(await recovery.current())) return;
      recovery.current = null;
      lock.current = false;
      if (mounted.current) {
        setPending(false);
        setBusy(false);
      }
    } catch {
      if (mounted.current) setError("暂时无法核实操作结果，请重新加载后再继续");
    } finally {
      recoveryRunning.current = false;
    }
  };
  const run = async (
    key: string,
    action: (requestId: string) => Promise<void>,
    options: PocketActionOptions = {},
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const requestId = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, requestId);
    const settings = { ...defaults, ...options };
    try {
      if (settings.transaction && !(await ensureAgreement())) return;
      if (!mounted.current) return;
      await action(requestId);
      requests.current.delete(key);
    } catch (reason) {
      if (!mounted.current) return;
      setError(pocketError(reason));
      recovery.current = settings.reconcile ?? null;
      if (recovery.current) {
        if (mounted.current) setPending(true);
        await recover();
      }
    } finally {
      if (!recovery.current) {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };
  return { busy, error, pending, recover, run, clearError: () => setError("") };
}

export function usePocketPolling(refresh: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshVisible, 2500);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh, active]);
}

export function PocketNotice({ children }: { children: ReactNode }) {
  return (
    <Alert
      role="status"
      className="border-[var(--badge-info-border)] bg-[var(--badge-info)] text-[var(--badge-info-foreground)]"
    >
      <RiInformationLine className="size-5" aria-hidden="true" />
      <AlertDescription className="font-medium leading-6 text-current">
        {children}
      </AlertDescription>
    </Alert>
  );
}

export function PocketError({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return retry ? (
    <LoadFailure variant="compact" title={message} onRetry={retry} />
  ) : (
    <LoadFailure variant="compact" title={message} />
  );
}
export function PocketLoading() {
  return (
    <div role="status" aria-label="正在加载" className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}
export function PocketHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="break-words text-lg font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
export function PocketPerson({
  user,
  detail,
  action,
}: {
  user: PocketUser;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={user.avatarUrl} alt="" />
        <AvatarFallback>
          {Array.from(user.name)[0] || <RiUser3Line className="size-5" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{user.name}</p>
        {detail ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {detail}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
export function PocketConsent({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-1 shrink-0"
      />
      <span>{children}</span>
    </label>
  );
}
export function PocketJobProgress({
  job,
  retry,
  busy,
}: {
  job: PocketJob;
  retry?: () => void;
  busy?: boolean;
}) {
  const kinds: Record<string, string> = {
    recognize: "合照识别",
    enroll: "人脸录入",
    revoke: "删除人脸",
    publish: "发起收款",
    cancel: "取消活动",
    delete_photos: "删除照片",
  };
  return (
    <Alert role="status">
      <AlertDescription className="flex flex-col gap-2">
        <div className="flex justify-between gap-3">
          <span>
            {kinds[job.kind] ?? "任务"} · {pocketJobLabel(job.status)}
          </span>
          <span className="tabular-nums">
            {job.completedItems} / {job.totalItems}
          </span>
        </div>
        {job.failedItems > 0 ? (
          <p className="text-muted-foreground">
            {job.failedItems} 项未完成
            {job.kind === "recognize" ? "，可重试或搜索姓名补选" : "，请重试"}
          </p>
        ) : null}
        {job.errorCode ? (
          <p className="break-all text-xs text-muted-foreground">
            {pocketJobError(job.errorCode)}
          </p>
        ) : null}
        {job.retryable && job.status === "failed" && retry ? (
          <Button
            size="touch"
            className="self-start"
            variant="outline"
            disabled={busy}
            onClick={retry}
          >
            重试任务
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
