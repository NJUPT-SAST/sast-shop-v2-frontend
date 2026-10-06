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
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
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
      totalCents = parsePocketAmount(amount);
      setValidationError("");
    } catch (reason) {
      setValidationError(
        reason instanceof Error ? reason.message : "请输入正确的金额",
      );
      return;
    }
    void run(`create:${title.trim()}:${totalCents}`, async (requestId) => {
      attempt.current = { title: title.trim(), totalCents, requestId };
      await complete(attempt.current);
    });
  }
  return (
    <div className="flex flex-col gap-4 py-4">
      <PocketHeading title="发起 Pocket" />
      <PocketError message={capabilities.error} retry={capabilities.refresh} />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FieldGroup>
          <Field data-invalid={Boolean(validationError)}>
            <FieldLabel htmlFor="pocket-total">总金额（元）</FieldLabel>
            <Input
              id="pocket-total"
              inputMode="decimal"
              placeholder="0.00"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy || created}
              aria-invalid={Boolean(validationError)}
              aria-describedby="pocket-amount-help"
            />
            <FieldDescription id="pocket-amount-help">
              发起收款前可修改金额
            </FieldDescription>
            <PocketError message={validationError} />
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
          size="lg"
          disabled={
            busy || created || !capabilities.data || Boolean(capabilities.error)
          }
        >
          {busy ? <Spinner data-icon="inline-start" /> : null}创建并选择分摊人
        </Button>
      </form>
      <p className="text-xs leading-6 text-muted-foreground">
        使用微信个人收款码，到账后由你确认
      </p>
    </div>
  );
}
