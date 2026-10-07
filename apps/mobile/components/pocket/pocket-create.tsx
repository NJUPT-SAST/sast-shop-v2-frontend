"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createPocket, getPocketCapabilities } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { parsePocketAmount } from "@/lib/pocket";
import {
  PocketError,
  PocketHeading,
  usePocketAction,
  usePocketOptions,
  usePocketResource,
} from "./shared";

export function PocketCreate() {
  const options = usePocketOptions();
  const router = useRouter();
  const capabilities = usePocketResource(
    useCallback(() => getPocketCapabilities(options), [options]),
  );
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [created, setCreated] = useState(false);
  const [validationError, setValidationError] = useState("");
  const amountInputRef = useRef<HTMLInputElement>(null);
  const checkingCapabilities = !capabilities.data && !capabilities.error;
  const mounted = useRef(true);
  const attempt = useRef<{
    title: string;
    totalCents: number;
    requestId: string;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const complete = async (input: NonNullable<typeof attempt.current>) => {
    const pocket = await createPocket(input, options);
    if (!mounted.current) return;
    setCreated(true);
    router.replace(`/pocket/${pocket.id}/capture`);
  };
  const { busy, error, pending, run, recover } = usePocketAction({
    transaction: true,
    reconcile: async () => {
      if (!attempt.current) return true;
      // The backend deduplicates the exact request and payload, including a lost response.
      await complete(attempt.current);
      return true;
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (created || !capabilities.data || capabilities.error) return;
    let totalCents: number;
    try {
      if (!amount.trim()) throw new Error("请输入总金额");
      totalCents = parsePocketAmount(amount);
      setValidationError("");
    } catch (reason) {
      setValidationError(
        reason instanceof Error ? reason.message : "请输入正确的金额",
      );
      amountInputRef.current?.focus();
      return;
    }
    void run(`create:${title.trim()}:${totalCents}`, async (requestId) => {
      attempt.current = { title: title.trim(), totalCents, requestId };
      await complete(attempt.current);
    });
  }
  return (
    <div className="flex min-w-0 flex-col gap-4 py-3">
      <PocketHeading title="发起 Pocket" />
      <PocketError message={capabilities.error} retry={capabilities.refresh} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(validationError)}>
            <FieldLabel htmlFor="pocket-total">总金额（元）</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText aria-hidden="true">¥</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                ref={amountInputRef}
                id="pocket-total"
                inputMode="decimal"
                placeholder="0.00"
                required
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setValidationError("");
                }}
                disabled={busy || created}
                aria-invalid={Boolean(validationError)}
                aria-describedby={
                  validationError
                    ? "pocket-amount-help pocket-amount-error"
                    : "pocket-amount-help"
                }
              />
            </InputGroup>
            {validationError ? (
              <FieldError id="pocket-amount-error">
                {validationError}
              </FieldError>
            ) : null}
            <FieldDescription id="pocket-amount-help">
              发起收款前可修改金额
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pocket-title">聚餐名称（选填）</FieldLabel>
            <Input
              id="pocket-title"
              placeholder="例如：周五晚饭"
              value={title}
              maxLength={100}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy || created}
            />
          </Field>
        </FieldGroup>
        <PocketError message={error} retry={pending ? recover : undefined} />
        <Button
          type="submit"
          size="touch"
          disabled={
            busy || created || !capabilities.data || Boolean(capabilities.error)
          }
        >
          {busy || checkingCapabilities ? (
            <Spinner data-icon="inline-start" />
          ) : null}
          {busy
            ? "正在创建"
            : checkingCapabilities
              ? "正在加载"
              : "创建并选择分摊人"}
        </Button>
      </form>
    </div>
  );
}
