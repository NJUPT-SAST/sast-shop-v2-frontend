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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Spinner } from "@workspace/ui/components/spinner";
import { pocketError, pocketJobLabel, pocketJobError } from "@/lib/west-pocket";

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
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let live = true;
    void load()
      .then((result) => {
        if (live) {
          setData(result);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (live) setError(pocketError(reason));
      });
    return () => {
      live = false;
    };
  }, [load, version]);
  return { data, setData, error, refresh };
}

export function usePocketAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const requests = useRef(new Map<string, string>());
  const run = async (
    key: string,
    action: (requestId: string) => Promise<void>,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const requestId = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, requestId);
    try {
      await action(requestId);
      requests.current.delete(key);
    } catch (reason) {
      setError(pocketError(reason));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run, clearError: () => setError("") };
}

export function usePocketPolling(refresh: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [refresh, active]);
}

export function PocketError({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-destructive/30 bg-card p-3 text-sm"
    >
      <p>{message}</p>
      {retry ? (
        <Button type="button" size="sm" variant="outline" onClick={retry}>
          重新加载
        </Button>
      ) : null}
    </div>
  );
}
export function PocketLoading() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
    >
      <Spinner />
      正在加载
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
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <h1 className="break-words text-xl font-semibold">{title}</h1>
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
        <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium">{user.name}</p>
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
    <label className="flex cursor-pointer items-start gap-3 py-2 text-sm leading-6">
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
    <div role="status" className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
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
          {job.failedItems} 项未完成，可重试或手动补选。
        </p>
      ) : null}
      {job.errorCode ? (
        <p className="break-all text-xs text-muted-foreground">
          {pocketJobError(job.errorCode)}
        </p>
      ) : null}
      {job.retryable && job.status === "failed" && retry ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={retry}>
          重试任务
        </Button>
      ) : null}
    </div>
  );
}
