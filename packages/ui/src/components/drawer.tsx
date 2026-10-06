"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "#lib/utils";
import { registerDrawerHistory } from "#lib/drawer-history";

function Drawer({
  direction = "bottom",
  open,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const id = React.useId();
  const state = React.useRef({ isOpen, dismissible, onOpenChange });
  React.useEffect(() => {
    state.current = { isOpen, dismissible, onOpenChange };
  });
  const changeOpen = React.useCallback((nextOpen: boolean) => {
    setUncontrolledOpen(nextOpen);
    state.current.onOpenChange?.(nextOpen);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    return registerDrawerHistory({
      id,
      isOpen: () => state.current.isOpen,
      onBack: () => {
        if (state.current.dismissible) changeOpen(false);
      },
    });
  }, [id, isOpen, changeOpen]);

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      direction={direction}
      open={isOpen}
      onOpenChange={changeOpen}
      dismissible={dismissible}
      {...props}
    />
  );
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/25 supports-backdrop-filter:backdrop-blur-xs motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[88dvh] flex-col overflow-hidden rounded-t-[18px] border bg-card text-sm text-card-foreground shadow-lg shadow-foreground/10 data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:right-auto data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:rounded-t-none data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:left-auto data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:rounded-t-none data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:bottom-auto data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:rounded-b-[18px] data-[vaul-drawer-direction=top]:rounded-t-none data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=left]/drawer-content:hidden group-data-[vaul-drawer-direction=right]/drawer-content:hidden group-data-[vaul-drawer-direction=top]/drawer-content:hidden dark:bg-muted-foreground/60" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 p-4 text-left", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex shrink-0 items-center gap-2 border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] [&>[data-slot=button]]:min-h-11 [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:flex-1 [&>[data-slot=button]]:whitespace-normal",
        className,
      )}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-center text-lg font-semibold leading-6 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
