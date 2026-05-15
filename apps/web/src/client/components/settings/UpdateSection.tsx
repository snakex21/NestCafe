import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getNestCafe, isRunningInElectron } from '@/lib/nestcafe';

export function UpdateSection() {
  const { t } = useTranslation('settings');
  const [autoCheck, setAutoCheck] = useState(true);
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoInstall, setAutoInstall] = useState(true);
  const [updateState, setUpdateState] = useState<{
    enabled: boolean;
    updateAvailable: boolean;
    downloadedVersion: string | null;
    availableVersion: string | null;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isRunningInElectron()) {
      return;
    }
    const nestcafe = getNestCafe();
    if (!nestcafe) {
      return;
    }

    const load = async () => {
      try {
        const [checkVal, downloadVal, installVal, state] = await Promise.all([
          nestcafe.getUpdateAutoCheck(),
          nestcafe.getUpdateAutoDownload(),
          nestcafe.getUpdateAutoInstall(),
          nestcafe.getUpdateState(),
        ]);
        setAutoCheck(checkVal);
        setAutoDownload(downloadVal);
        setAutoInstall(installVal);
        setUpdateState(state);
      } catch {
        // Not available in this build
      }
    };
    void load();
  }, []);

  const nestcafe = getNestCafe();

  const handleToggle = async (
    current: boolean,
    setter: (v: boolean) => void,
    apiSet: (v: boolean) => Promise<void>,
  ) => {
    const next = !current;
    setter(next);
    try {
      await apiSet(next);
    } catch {
      setter(current);
    }
  };

  const handleCheck = async () => {
    if (!nestcafe) {
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await nestcafe.checkForUpdates();
      setCheckResult(result.success ? 'checked' : 'failed');
      const state = await nestcafe.getUpdateState();
      setUpdateState(state);
    } catch {
      setCheckResult('failed');
    } finally {
      setChecking(false);
    }
  };

  const handleInstall = async () => {
    if (!nestcafe) {
      return;
    }
    setInstalling(true);
    try {
      await nestcafe.quitAndInstall();
    } catch {
      setInstalling(false);
    }
  };

  if (!isRunningInElectron() || !nestcafe) {
    return null;
  }

  return (
    <section>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        {t('updates.title', 'Updates')}
      </h4>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        {/* Auto-check toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {t('updates.autoCheckLabel', 'Automatically check for updates')}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'updates.autoCheckDescription',
                'Check for new versions on app startup (once per day).',
              )}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={autoCheck}
            onClick={() =>
              handleToggle(autoCheck, setAutoCheck, (v) => nestcafe.setUpdateAutoCheck(v))
            }
            className={`relative ml-4 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              autoCheck ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                autoCheck ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto-download toggle */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {t('updates.autoDownloadLabel', 'Automatically download updates')}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'updates.autoDownloadDescription',
                'Download new versions in the background when they are found.',
              )}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={autoDownload}
            onClick={() =>
              handleToggle(autoDownload, setAutoDownload, (v) => nestcafe.setUpdateAutoDownload(v))
            }
            className={`relative ml-4 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              autoDownload ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                autoDownload ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto-install toggle */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {t('updates.autoInstallLabel', 'Automatically install updates on quit')}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'updates.autoInstallDescription',
                'Install downloaded updates automatically when you quit the app.',
              )}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={autoInstall}
            onClick={() =>
              handleToggle(autoInstall, setAutoInstall, (v) => nestcafe.setUpdateAutoInstall(v))
            }
            className={`relative ml-4 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              autoInstall ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                autoInstall ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Update status & actions */}
        <div className="border-t border-border pt-4 space-y-3">
          {/* Status line */}
          <div className="flex items-center gap-2 text-sm">
            {updateState?.updateAvailable && updateState?.downloadedVersion ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="text-foreground">
                  {t('updates.downloadedStatus', 'Update downloaded: version {{version}}', {
                    version: updateState.downloadedVersion,
                  })}
                </span>
              </>
            ) : updateState?.updateAvailable ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-foreground">
                  {t('updates.availableStatus', 'Update available: version {{version}}', {
                    version: updateState.availableVersion,
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('updates.upToDate', 'You are up to date')}
                </span>
              </>
            )}
          </div>

          {/* Result message */}
          {checkResult === 'checked' && (
            <p className="text-sm text-muted-foreground">
              {t('updates.checkComplete', 'Update check complete.')}
            </p>
          )}
          {checkResult === 'failed' && (
            <p className="text-sm text-destructive">
              {t('updates.checkFailed', 'Update check failed. Please try again later.')}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCheck}
              disabled={checking}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {checking
                ? t('updates.checking', 'Checking...')
                : t('updates.checkNow', 'Check Now')}
            </button>
            {updateState?.downloadedVersion && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {installing
                  ? t('updates.installing', 'Installing...')
                  : t('updates.restartToInstall', 'Restart to Install')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
