"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TransactionAgreementProvider as AgreementProvider } from "@workspace/ui/components/transaction-agreement";

export { useTransactionAgreement } from "@workspace/ui/components/transaction-agreement";

export function TransactionAgreementProvider({
  children,
  requireUserIdentity = false,
}: {
  children: ReactNode;
  requireUserIdentity?: boolean;
}) {
  const pathname = usePathname();
  return (
    <AgreementProvider key={pathname} requireUserIdentity={requireUserIdentity}>
      {children}
    </AgreementProvider>
  );
}
