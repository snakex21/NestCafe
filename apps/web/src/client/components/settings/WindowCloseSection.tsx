import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getNestCafe } from '@/lib/nestcafe';
import {
  getShowCloseConfirmDialog,
  normalizeCloseBehavior,
  setShowCloseConfirmDialog,
  type CloseBehavior,
} from '@/lib/closeBehaviorPreference';

export function WindowCloseSection() {
  const { t } = useTranslation('settings');
  const [showPrompt, setShowPrompt] = useState(() => getShowCloseConfirmDialog());
  const [closeBehavior, setCloseBehaviorState] = useState<CloseBehavior>('keep-daemon');

  useEffect(() => {
    let cancelled = false;
    getNestCafe()
      .getCloseBehavior()
      .then((value) => {
        if (!cancelled) {
          setCloseBehaviorState(normalizeCloseBehavior(value));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloseBehaviorState('keep-daemon');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePromptToggle = () => {
    const next = !showPrompt;
    setShowPrompt(next);
    setShowCloseConfirmDialog(next);
  };

  const handleBehaviorChange = async (behavior: CloseBehavior) => {
    setCloseBehaviorState(behavior);
    await getNestCafe().setCloseBehavior(behavior);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-foreground">{t('closeDialog.askLabel')}</div>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {t('closeDialog.askDescription')}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={showPrompt}
          data-testid="settings-close-dialog-toggle"
          onClick={handlePromptToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-nestcafe ${
            showPrompt ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-nestcafe ${
              showPrompt ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {!showPrompt && (
        <div className="mt-4 space-y-2 rounded-xl bg-muted/30 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('closeDialog.defaultAction')}
          </div>
          <button
            type="button"
            onClick={() => void handleBehaviorChange('keep-daemon')}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-background/70"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                closeBehavior === 'keep-daemon' ? 'border-primary' : 'border-muted-foreground/40'
              }`}
            >
              {closeBehavior === 'keep-daemon' && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                {t('closeDialog.keepDaemonTitle')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('closeDialog.keepDaemonDescription')}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleBehaviorChange('stop-daemon')}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-background/70"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                closeBehavior === 'stop-daemon'
                  ? 'border-destructive'
                  : 'border-muted-foreground/40'
              }`}
            >
              {closeBehavior === 'stop-daemon' && (
                <span className="h-2 w-2 rounded-full bg-destructive" />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                {t('closeDialog.stopDaemonTitle')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('closeDialog.stopDaemonDescription')}
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
