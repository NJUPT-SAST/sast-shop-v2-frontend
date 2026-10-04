"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";

type HeaderActionsContext = {
  host: HTMLDivElement | null;
  setHost: Dispatch<SetStateAction<HTMLDivElement | null>>;
};

const HeaderActionsContext = createContext<HeaderActionsContext | null>(null);

function stopContentTouchGesture(event: TouchEvent<HTMLDivElement>) {
  // Portal events bubble through the content tree, outside their DOM container.
  event.stopPropagation();
}

export function MobileHeaderActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function MobileHeaderActionSlot() {
  const context = useContext(HeaderActionsContext);

  return (
    <div
      ref={context?.setHost}
      className="flex min-h-11 min-w-0 items-center justify-end"
    />
  );
}

export function MobileHeaderActions({ children }: { children: ReactNode }) {
  const context = useContext(HeaderActionsContext);

  return context?.host
    ? createPortal(
        <div
          data-slot="mobile-header-action"
          className="flex shrink-0 items-center"
          onTouchStart={stopContentTouchGesture}
          onTouchMove={stopContentTouchGesture}
          onTouchEnd={stopContentTouchGesture}
        >
          {children}
        </div>,
        context.host,
      )
    : null;
}
