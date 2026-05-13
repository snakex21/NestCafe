import { WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = true,
}: ConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-border/70 p-0 shadow-2xl sm:rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive/20 via-destructive to-destructive/20" />
        <div className="p-6">
          <DialogHeader className="gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <WarningCircle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl tracking-[-0.02em]">{title}</DialogTitle>
              <DialogDescription className="leading-relaxed">{description}</DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
