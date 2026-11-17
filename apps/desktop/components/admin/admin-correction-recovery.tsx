"use client";

import { useEffect, useRef, useState } from "react";
import {
  executeAdminCorrection,
  getAdminCorrection,
  type AdminCorrection,
  type AdminDomain,
} from "@sast-shop/api";
import {
  AdminExecutionIntentError,
  getAdminExecutionRequestId,
  clearAdminExecutionRequestId,
} from "@/lib/admin-execution-intent";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { AdminError, AdminCorrectionResult } from "./admin-common";
import { useAdminSession } from "./admin-session";

/** Recovery uses the persisted case and request; it never creates another correction. */
export function AdminCorrectionRecovery({
  domain,
  correction,
  onChanged,
}: {
  domain: AdminDomain;
  correction: AdminCorrection;
  onChanged: () => void;
}) {
  const { identity, options } = useAdminSession();
  const [current, setCurrent] = useState(correction);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(correction.requestId || "");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const canResume =
    !storageBlocked &&
    identity.capabilities.includes("corrections.execute") &&
    ["preview", "needs_attention"].includes(current.status) &&
    Boolean(current.digest) &&
    (current.status === "preview" || Boolean(current.requestId));

  async function read() {
    const value = await getAdminCorrection(domain, current.id, options);
    if (mounted.current) {
      setCurrent(value);
      setUncertain(false);
      setChecked(false);
      setError("");
      if (value.requestId) {
        requestId.current = value.requestId;
        setStorageBlocked(false);
      }
      if (["completed", "succeeded"].includes(value.status))
        clearAdminExecutionRequestId(identity.id, domain, value.id);
    }
    onChanged();
  }
  async function run(execute: boolean) {
    if (lock.current || (execute && (!checked || !canResume || uncertain)))
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (execute) {
        requestId.current = getAdminExecutionRequestId(
          identity.id,
          domain,
          current.id,
          current.requestId,
        );
        setUncertain(true);
        try {
          await executeAdminCorrection(
            domain,
            {
              previewId: current.id,
              digest: current.digest!,
              requestId: requestId.current,
            },
            options,
          );
        } finally {
          // Always verify the same case, including when the execute response was lost.
          await read();
        }
      } else await read();
    } catch (reason) {
      if (mounted.current && reason instanceof AdminExecutionIntentError)
        setStorageBlocked(true);
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : "暂时无法核实处理结果",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <AdminCorrectionResult correction={current} />
      {error ? <AdminError message={error} /> : null}
      {uncertain ? (
        <p role="status" className="text-sm">
          结果尚未确认，请查询原处理记录后继续。
        </p>
      ) : null}
      {canResume && !uncertain ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={checked}
            disabled={busy}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          已核对上述依据与处理步骤，继续同一次处理
        </label>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void run(false)}
        >
          核实处理进度
        </Button>
        {canResume && !uncertain ? (
          <Button disabled={busy || !checked} onClick={() => void run(true)}>
            继续此处理
          </Button>
        ) : null}
      </div>
    </div>
  );
}
