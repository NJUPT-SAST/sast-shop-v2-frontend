"use client";

import { deletePocketPhoto, getPocket } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { PocketError, usePocketAction, usePocketOptions } from "./shared";

export function PocketPhotoDeleteDialog({
  pocketId,
  photoId,
  onClose,
  onDeleted,
}: {
  pocketId: string;
  photoId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const options = usePocketOptions();
  const action = usePocketAction({
    reconcile: async () => {
      const latest = await getPocket(pocketId, options);
      if (
        !latest.photos.some(
          (photo) => photo.id === photoId && photo.status !== "deleted",
        )
      ) {
        onDeleted();
        onClose();
      }
      return true;
    },
  });
  return (
    <Drawer
      open
      dismissible={!action.busy}
      onOpenChange={(open) => {
        if (!open && !action.busy) onClose();
      }}
    >
      <DrawerContent className="max-h-[88dvh] overflow-clip">
        <DrawerHeader className="shrink-0 pb-3 text-center">
          <DrawerTitle>删除这张合照？</DrawerTitle>
          <DrawerDescription className="leading-6">
            照片删除后无法查看，分摊名单和账单不受影响
          </DrawerDescription>
        </DrawerHeader>
        <div
          className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4"
          aria-busy={action.busy}
        >
          <PocketError
            message={action.error}
            retry={action.pending ? action.recover : undefined}
          />
        </div>
        <DrawerFooter>
          <Button
            size="touch"
            variant="outline"
            disabled={action.busy}
            onClick={onClose}
          >
            保留照片
          </Button>
          <Button
            size="touch"
            variant="destructive"
            disabled={action.busy}
            onClick={() => {
              void action.run(`delete:${photoId}`, async (requestId) => {
                await deletePocketPhoto(
                  { pocketId, photoId, requestId },
                  options,
                );
                onDeleted();
                onClose();
              });
            }}
          >
            {action.busy ? <Spinner data-icon="inline-start" /> : null}
            确认删除
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
