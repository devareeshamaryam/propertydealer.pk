"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmRequest {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
  onClose: () => void;
}

/**
 * Styled replacement for window.confirm(), which the dashboard used in 21
 * places. Native confirm() blocks the main thread, cannot be styled, and is
 * suppressible by the browser — this keeps the pending state visible while the
 * delete request is in flight instead.
 */
export function ConfirmDialog({ request, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!request) return;
    try {
      setBusy(true);
      await request.onConfirm();
      onClose();
    } finally {
      // The caller surfaces failures via toast; always release the button so the
      // dialog can never get stuck in a spinning state.
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {request?.title ?? "Are you sure?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {request?.description ?? "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {request?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog mounted while the request runs.
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={busy}
            className={cn(
              request?.destructive !== false &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {request?.confirmLabel ?? "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Pairs with <ConfirmDialog />:
 *
 *   const { confirm, dialogProps } = useConfirm();
 *   ...
 *   confirm({ description: "Delete this rate?", onConfirm: () => remove(id) });
 *   ...
 *   <ConfirmDialog {...dialogProps} />
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  return {
    confirm,
    dialogProps: { request, onClose: close },
  };
}
