import type { ReactNode } from "react";
import { PocketProvider } from "@/components/pocket/shared";
import { mobileAppConfig } from "@/lib/app-config";

export default function PocketLayout({ children }: { children: ReactNode }) {
  return (
    <PocketProvider
      options={{
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }}
    >
      {children}
    </PocketProvider>
  );
}
