"use client";

import { useEffect, useRef, useState } from "react";
import {
  adminDomainFor,
  AdminRequestError,
  executeAdminCorrection,
  getAdminCorrection,
  listAdminAudit,
  mutateAdminRecord,
  previewAdminCorrection,
  type AdminCorrection,
  type AdminPreview,
  type AdminRecord,
} from "@sast-shop/api";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  actionLabels,
  adminDate,
  adminFormFields,
  isCorrectionAction,
  restorationChoices,
} from "@/lib/admin-fields";
import {
  AdminExecutionIntentError,
  getAdminExecutionRequestId,
  clearAdminExecutionRequestId,
} from "@/lib/admin-execution-intent";
import { AdminSelect, AdminError, AdminImpacts } from "./admin-common";
import { AdminAssignmentsField } from "./admin-assignments-field";
import { AdminCorrectionRecovery } from "./admin-correction-recovery";
import { useAdminSession } from "./admin-session";

export function AdminActionDialog({
  record,
  action,
  onClose,
  onChanged,
}: {
  record: AdminRecord;
  action: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { options, identity } = useAdminSession();
  const definitions = adminFormFields(record.resource, action);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definitions.map((field) => [
        field.key,
        field.type === "checkbox"
          ? ""
          : (record.fields.find((item) => item.key === field.key)?.value ??
            (field.key === "theme_color" ? "#c9431f" : "")),
      ]),
    ),
  );
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [preview, setPreview] = useState<AdminPreview | null>(null);
  const [restorationFields, setRestorationFields] = useState<
    AdminPreview["restorationFields"]
  >([]);
  const [correction, setCorrection] = useState<AdminCorrection | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const requestId = useRef<string | null>(null);
  const serverExecutionRequestId = useRef<string | undefined>(undefined);
  const correctionAction = isCorrectionAction(action);
  const domain = adminDomainFor(record.resource);
  const activeCorrection =
    correction && ["executing", "retrying"].includes(correction.status);
  const immutable =
    busy || uncertain || Boolean(activeCorrection) || saved || storageBlocked;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!activeCorrection || !correction) return;
    const timer = window.setInterval(() => {
      void reconcile();
    }, 2500);
    return () => clearInterval(timer);
  });
  function input() {
    return {
      resource: record.resource,
      id: record.id,
      action,
      updatedAt: record.updatedAt,
      round: record.round,
      reason,
      evidence,
      values: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          key === "deadline" && value ? new Date(value).toISOString() : value,
        ]),
      ),
    };
  }
  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setPreview(null);
    requestId.current = null;
    serverExecutionRequestId.current = undefined;
  }
  function acceptCorrection(result: AdminCorrection) {
    if (!alive.current) return;
    if (result.requestId) serverExecutionRequestId.current = result.requestId;
    setUncertain(false);
    if (result.status === "preview") {
      setCorrection(null);
      setMessage("已核实本次处理尚未执行，可按原预览再次确认执行");
      return;
    }
    setCorrection(result);
    if (["completed", "succeeded"].includes(result.status)) {
      clearAdminExecutionRequestId(identity.id, domain, result.id);
      setSaved(true);
      onChanged();
    }
  }
  async function reconcile() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (correctionAction && (correction?.id || preview?.id)) {
        acceptCorrection(
          await getAdminCorrection(
            domain,
            correction?.id ?? preview!.id,
            options,
          ),
        );
      } else if (requestId.current) {
        const result = await listAdminAudit(
          domain,
          {
            resource: record.resource,
            resourceId: record.id,
            requestId: requestId.current,
          },
          options,
        );
        if (!alive.current) return;
        if (
          result.entries.some((entry) => entry.requestId === requestId.current)
        ) {
          setUncertain(false);
          setSaved(true);
          setMessage("");
          onChanged();
        } else
          setMessage(
            "尚未找到该次操作的完成记录，请稍后再次核实；当前不会重复提交",
          );
      }
    } catch (error) {
      if (alive.current)
        setMessage(
          error instanceof Error ? error.message : "暂时无法核实处理结果",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function submit() {
    if (lock.current || immutable) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (correctionAction) {
        const result = await previewAdminCorrection(input(), options);
        if (alive.current) {
          setPreview(result);
          setRestorationFields(result.restorationFields);
          requestId.current = null;
          serverExecutionRequestId.current = undefined;
          if (result.restorationFields.length) {
            setValues((current) => ({
              ...Object.fromEntries(
                result.restorationFields.map((field) => [
                  field.key,
                  field.value,
                ]),
              ),
              ...current,
            }));
          }
        }
      } else {
        requestId.current ??= crypto.randomUUID();
        await mutateAdminRecord(
          { ...input(), requestId: requestId.current },
          options,
        );
        if (alive.current) {
          setSaved(true);
          onChanged();
        }
      }
    } catch (error) {
      if (!alive.current) return;
      setMessage(error instanceof Error ? error.message : "操作未完成");
      if (
        !correctionAction &&
        error instanceof AdminRequestError &&
        error.uncertain
      )
        setUncertain(true);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function execute() {
    if (lock.current || immutable || !preview) return;
    if (
      !preview.expiresAt ||
      new Date(preview.expiresAt).getTime() <= Date.now()
    ) {
      setMessage("预览已过期，请重新预览最新影响");
      setPreview(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      requestId.current = getAdminExecutionRequestId(
        identity.id,
        domain,
        preview.id,
        serverExecutionRequestId.current,
      );
      acceptCorrection(
        await executeAdminCorrection(
          domain,
          {
            previewId: preview.id,
            digest: preview.digest,
            requestId: requestId.current,
          },
          options,
        ),
      );
    } catch (error) {
      if (!alive.current) return;
      setMessage(error instanceof Error ? error.message : "处理结果尚未确认");
      if (error instanceof AdminExecutionIntentError) setStorageBlocked(true);
      if (error instanceof AdminRequestError && error.uncertain) {
        setUncertain(true);
        try {
          acceptCorrection(
            await getAdminCorrection(domain, preview.id, options),
          );
        } catch {
          /* Keep the write locked until the exact durable case can be read. */
        }
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const restoration = restorationFields.filter(
    (field) => !definitions.some((definition) => definition.key === field.key),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !uncertain && !activeCorrection) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col sm:max-w-2xl"
        showCloseButton={!immutable}
      >
        <DialogHeader>
          <DialogTitle>
            {actionLabels[action] ?? action} · {record.title || "新记录"}
          </DialogTitle>
          <DialogDescription>
            {correctionAction
              ? "先核对整单影响，再依据核查结果执行；原业务编号保留，历史处理可追溯"
              : "填写处理原因和可核查的依据，提交后记录操作历史"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {message ? <AdminError message={message} /> : null}
          {saved ? (
            <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
              操作已完成，列表与详情已刷新
            </p>
          ) : null}
          {uncertain ? (
            <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
              请求结果尚未确认。请核实此次操作记录后继续，避免重复处理
            </p>
          ) : null}
          {!saved && !correction ? (
            <form
              id="admin-action-form"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {definitions.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`admin-${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  {field.key === "restore_assignments" ? (
                    <AdminAssignmentsField
                      value={values[field.key] ?? ""}
                      disabled={immutable}
                      onChange={(value) => updateValue(field.key, value)}
                    />
                  ) : field.type === "checkbox" ? (
                    <Checkbox
                      id={`admin-${field.key}`}
                      checked={values[field.key] === "true"}
                      disabled={immutable}
                      onCheckedChange={(checked) =>
                        updateValue(field.key, checked === true ? "true" : "")
                      }
                    />
                  ) : field.choices ? (
                    <AdminSelect
                      id={`admin-${field.key}`}
                      label={field.label}
                      required={field.required}
                      disabled={immutable}
                      value={values[field.key] ?? ""}
                      onChange={(value) => updateValue(field.key, value)}
                      choices={field.choices}
                      placeholder="请选择已核实的处理方式"
                    />
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={`admin-${field.key}`}
                      value={values[field.key] ?? ""}
                      disabled={immutable}
                      required={field.required}
                      onChange={(event) =>
                        updateValue(field.key, event.target.value)
                      }
                    />
                  ) : (
                    <Input
                      id={`admin-${field.key}`}
                      type={field.type ?? "text"}
                      min={field.min}
                      step={field.type === "number" ? 1 : undefined}
                      value={values[field.key] ?? ""}
                      disabled={immutable}
                      required={field.required}
                      onChange={(event) =>
                        updateValue(field.key, event.target.value)
                      }
                    />
                  )}
                  {field.help ? (
                    <p className="text-xs text-muted-foreground">
                      {field.help}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="admin-reason">处理原因 *</Label>
                <Textarea
                  id="admin-reason"
                  required
                  maxLength={1000}
                  value={reason}
                  disabled={immutable}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="说明发现的问题和本次处理目的"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-evidence">核查依据 *</Label>
                <Textarea
                  id="admin-evidence"
                  required
                  maxLength={4000}
                  value={evidence}
                  disabled={immutable}
                  onChange={(event) => {
                    setEvidence(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="填写凭据编号、核查记录或证据链接"
                />
              </div>
              {restoration.length ? (
                <fieldset className="space-y-3 rounded-lg border p-4">
                  <legend className="px-1 text-sm font-medium">
                    补充已核实的历史数据
                  </legend>
                  {restoration.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`restore-${field.key}`}>
                        {field.label}
                      </Label>
                      {field.key === "restore_assignments" ? (
                        <AdminAssignmentsField
                          value={values[field.key] ?? ""}
                          disabled={immutable}
                          onChange={(value) => updateValue(field.key, value)}
                        />
                      ) : restorationChoices(field.key) ? (
                        <AdminSelect
                          id={`restore-${field.key}`}
                          label={field.label}
                          value={values[field.key] ?? ""}
                          disabled={immutable}
                          choices={restorationChoices(field.key)!}
                          onChange={(value) => updateValue(field.key, value)}
                        />
                      ) : (
                        <Input
                          id={`restore-${field.key}`}
                          type={
                            field.key === "deadline"
                              ? "datetime-local"
                              : field.key === "quantity" ||
                                  field.key.endsWith("_cents")
                                ? "number"
                                : "text"
                          }
                          min={
                            field.key === "quantity" ||
                            field.key.endsWith("_cents")
                              ? 1
                              : undefined
                          }
                          step={
                            field.key === "quantity" ||
                            field.key.endsWith("_cents")
                              ? 1
                              : undefined
                          }
                          value={values[field.key] ?? ""}
                          disabled={immutable}
                          onChange={(event) =>
                            updateValue(field.key, event.target.value)
                          }
                        />
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    补充后请重新预览，再确认最终影响
                  </p>
                </fieldset>
              ) : null}
            </form>
          ) : null}
          {preview && !correction ? (
            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">本次变更影响</h3>
              <p className="text-xs text-muted-foreground">
                有效至 {adminDate(preview.expiresAt)}
              </p>
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-sm text-destructive">
                  {warning}
                </p>
              ))}
              <AdminImpacts impacts={preview.impacts} />
            </section>
          ) : null}
          {correction ? (
            <AdminCorrectionRecovery
              key={`${correction.id}:${correction.updatedAt}`}
              domain={domain}
              correction={correction}
              onChanged={onChanged}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            disabled={busy || uncertain || Boolean(activeCorrection)}
            onClick={onClose}
          >
            {saved ? "完成" : "关闭"}
          </Button>
          {uncertain || activeCorrection ? (
            <Button disabled={busy} onClick={() => void reconcile()}>
              {busy ? "核实中…" : "核实执行结果"}
            </Button>
          ) : !saved && !correction ? (
            <>
              <Button
                disabled={immutable}
                type="submit"
                form="admin-action-form"
                variant={preview ? "outline" : "default"}
              >
                {busy
                  ? "处理中…"
                  : correctionAction
                    ? "预览变更影响"
                    : "确认提交"}
              </Button>
              {preview ? (
                <Button
                  disabled={immutable || preview.restorationFields.length > 0}
                  onClick={() => void execute()}
                >
                  按此预览执行
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
