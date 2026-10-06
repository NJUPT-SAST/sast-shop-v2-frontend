"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "#components/alert";
import { Button } from "#components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "#components/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/dialog";
import { cn } from "#lib/utils";
import { HighlightedText } from "#components/text-highlight";
import {
  hasAcceptedTransactionAgreement,
  saveTransactionAgreementAcceptance,
  transactionAgreementContent,
  TRANSACTION_AGREEMENT_READING_MS,
} from "#lib/transaction-agreement";

interface AgreementContextValue {
  ensureAgreement: (beforePrompt?: () => void) => Promise<boolean>;
  openAgreement: () => void;
}

const AgreementContext = createContext<AgreementContextValue | null>(null);

export function useTransactionAgreement() {
  const context = useContext(AgreementContext);
  if (!context) {
    throw new Error(
      "useTransactionAgreement requires TransactionAgreementProvider",
    );
  }
  return context;
}

export function TransactionAgreementProvider({
  children,
  requireUserIdentity = false,
  presentation = "drawer",
}: {
  children: ReactNode;
  requireUserIdentity?: boolean;
  presentation?: "drawer" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "consent">("view");
  const [seconds, setSeconds] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const deadlineRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef<{
    resolve: (accepted: boolean) => void;
    userId?: string;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.resolve(false);
    };
  }, []);

  useEffect(() => {
    if (!open || mode !== "consent") return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - performance.now());
      setSeconds(Math.ceil(remaining / 1_000));
      if (remaining === 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [mode, open]);

  async function currentUserId() {
    if (!requireUserIdentity) return undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        signal: controller.signal,
      });
      const session = (await response.json()) as {
        authenticated?: boolean;
        user?: { id?: unknown };
      };
      if (
        !response.ok ||
        session.authenticated !== true ||
        typeof session.user?.id !== "string" ||
        !session.user.id
      ) {
        throw new Error("无法确认当前登录用户，请重新登录后再试");
      }
      return session.user.id;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function finish(accepted: boolean) {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    pending?.resolve(accepted);
  }

  function ensureAgreement(beforePrompt?: () => void): Promise<boolean> {
    if (pendingRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      const pending = { resolve, userId: undefined as string | undefined };
      pendingRef.current = pending;
      void currentUserId()
        .then((userId) => {
          if (!mountedRef.current || pendingRef.current !== pending) return;
          pending.userId = userId;
          if (hasAcceptedTransactionAgreement(userId)) {
            pendingRef.current = null;
            resolve(true);
            return;
          }
          beforePrompt?.();
          setMode("consent");
          setError(null);
          setSeconds(5);
          deadlineRef.current =
            performance.now() + TRANSACTION_AGREEMENT_READING_MS;
          setOpen(true);
        })
        .catch((reason: unknown) => {
          if (!mountedRef.current || pendingRef.current !== pending) return;
          pendingRef.current = null;
          toast.error(
            reason instanceof Error
              ? reason.message
              : "暂时无法确认登录状态，请稍后重试",
          );
          resolve(false);
        });
    });
  }

  async function acceptAgreement() {
    const pending = pendingRef.current;
    if (
      !pending ||
      savingRef.current ||
      performance.now() < deadlineRef.current
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      let userId: string | undefined;
      try {
        userId = await currentUserId();
      } catch {
        if (mountedRef.current && pendingRef.current === pending) {
          setError("无法确认当前登录状态，请检查网络后重试。");
        }
        return;
      }
      if (!mountedRef.current || pendingRef.current !== pending) return;
      if (pending.userId !== userId) {
        finish(false);
        toast.info("登录用户已变化，请重新发起操作");
        return;
      }
      saveTransactionAgreementAcceptance(userId);
      finish(true);
    } catch {
      if (mountedRef.current && pendingRef.current === pending) {
        setError("无法保存同意记录，请允许浏览器使用本地存储后重试。");
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  function openAgreement() {
    if (pendingRef.current) return;
    setMode("view");
    setError(null);
    setOpen(true);
  }

  const desktop = presentation === "dialog";
  const Overlay = desktop ? Dialog : Drawer;
  const Content = desktop ? DialogContent : DrawerContent;
  const Header = desktop ? DialogHeader : DrawerHeader;
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;
  const Footer = desktop ? DialogFooter : DrawerFooter;

  return (
    <AgreementContext.Provider value={{ ensureAgreement, openAgreement }}>
      {children}
      <Overlay
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) finish(false);
        }}
      >
        <Content
          className={
            desktop
              ? "flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl"
              : undefined
          }
        >
          <Header className={cn("shrink-0", desktop && "px-6 py-5")}>
            <Title>{transactionAgreementContent.title}</Title>
            <Description className={desktop ? undefined : "text-center"}>
              {mode === "consent"
                ? transactionAgreementContent.consentDescription
                : transactionAgreementContent.viewDescription}
            </Description>
          </Header>
          <div
            className={cn(
              "app-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 pb-4",
              desktop && "px-6 pb-5",
              mode === "view" &&
                (desktop
                  ? "pb-6"
                  : "pb-[calc(2rem+env(safe-area-inset-bottom))]"),
            )}
            data-vaul-no-drag
          >
            <article className="flex flex-col gap-4 text-sm leading-6">
              {transactionAgreementContent.sections.map((section) => (
                <section key={section.title} className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">{section.title}</h3>
                  <p
                    className={
                      section.important
                        ? "font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    <HighlightedText
                      text={section.text}
                      highlights={section.highlights}
                    />
                  </p>
                </section>
              ))}
            </article>
          </div>
          {mode === "consent" ? (
            <Footer
              className={cn(
                "shrink-0 border-t flex-col items-stretch",
                desktop ? "flex-col p-6 sm:flex-col" : undefined,
              )}
            >
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => finish(false)}
                >
                  暂不同意
                </Button>
                <Button
                  className="min-h-11 min-w-0 flex-1 whitespace-normal"
                  aria-label="同意并继续"
                  disabled={seconds > 0 || saving}
                  onClick={() => void acceptAgreement()}
                >
                  {saving
                    ? "保存中"
                    : seconds > 0
                      ? `同意并继续（${seconds}秒）`
                      : "同意并继续"}
                </Button>
              </div>
            </Footer>
          ) : null}
        </Content>
      </Overlay>
    </AgreementContext.Provider>
  );
}
