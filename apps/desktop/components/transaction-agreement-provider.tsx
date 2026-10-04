"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  TransactionAgreementProvider as SharedTransactionAgreementProvider,
  useTransactionAgreement,
} from "@workspace/ui/components/transaction-agreement";

export { useTransactionAgreement };

export function TransactionAgreementProvider({
  children,
  requireUserIdentity = false,
}: {
  children: ReactNode;
  requireUserIdentity?: boolean;
}) {
  const pathname = usePathname();
  return (
    <SharedTransactionAgreementProvider
      key={pathname}
      presentation="dialog"
      requireUserIdentity={requireUserIdentity}
    >
      {children}
    </SharedTransactionAgreementProvider>
  );
}
