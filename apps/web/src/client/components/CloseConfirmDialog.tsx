/**
 * CloseConfirmDialog — themed close confirmation shown when the user
 * clicks the window close button. Replaces the native OS dialog with
 * a Radix-based dialog matching the app's design system.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Warning, Power, ArrowRight } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNestCafe } from '@/lib/nestcafe';
import { getShowCloseConfirmDialog, normalizeCloseBehavior } from '@/lib/closeBehaviorPreference';

type CloseDecision = 'keep-daemon' | 'stop-daemon';

export function CloseConfirmDialog() {
  const { t } = useTranslation('settings');
  const nestcafe = useNestCafe();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<CloseDecision>('keep-daemon');

  useEffect(() => {
    if (!nestcafe.onCloseRequested) {
      return;
    }
    const unsubscribe = nestcafe.onCloseRequested(() => {
      nestcafe
        .getCloseBehavior()
        .then((value) => {
          const savedDecision = normalizeCloseBehavior(value);
          if (!getShowCloseConfirmDialog()) {
            nestcafe.respondToClose?.(savedDecision);
            return;
          }
          setDecision(savedDecision);
          setOpen(true);
        })
        .catch(() => {
          setDecision('keep-daemon');
          setOpen(true);
        });
    });
    return unsubscribe;
  }, [nestcafe]);

  const handleConfirm = useCallback(async () => {
    setOpen(false);
    await nestcafe.setCloseBehavior(decision).catch(() => {});
    nestcafe.respondToClose?.(decision);
  }, [nestcafe, decision]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    nestcafe.respondToClose?.('cancel');
  }, [nestcafe]);

  const isKeepDaemon = decision === 'keep-daemon';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Power className="h-5 w-5" weight="bold" />
            {t('closeDialog.title')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('closeDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Option 1: Keep daemon */}
          <button
            type="button"
            onClick={() => setDecision('keep-daemon')}
            className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
              isKeepDaemon
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            <div
              className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                isKeepDaemon ? 'border-primary' : 'border-muted-foreground/40'
              }`}
            >
              {isKeepDaemon && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground">
                {t('closeDialog.keepDaemonTitle')}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t('closeDialog.keepDaemonLongDescription')}
              </p>
            </div>
          </button>

          {/* Option 2: Stop daemon */}
          <button
            type="button"
            onClick={() => setDecision('stop-daemon')}
            className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
              !isKeepDaemon
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            <div
              className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                !isKeepDaemon ? 'border-destructive' : 'border-muted-foreground/40'
              }`}
            >
              {!isKeepDaemon && <div className="h-2 w-2 rounded-full bg-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground">
                {t('closeDialog.stopDaemonTitle')}
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t('closeDialog.stopDaemonLongDescription')}
              </p>
            </div>
          </button>

          {/* Warning when stop-daemon is selected */}
          {!isKeepDaemon && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <Warning className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" weight="bold" />
              <p className="text-xs text-destructive leading-relaxed">
                {t('closeDialog.stopWarning')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            {t('closeDialog.cancel')}
          </Button>
          <Button
            variant={isKeepDaemon ? 'default' : 'destructive'}
            onClick={handleConfirm}
            className="gap-1.5"
          >
            {isKeepDaemon ? t('closeDialog.close') : t('closeDialog.closeAndStop')}
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
