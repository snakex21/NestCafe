import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getNestCafe, isRunningInElectron } from '@/lib/nestcafe';

interface AboutTabProps {
  appVersion: string;
}

export function AboutTab({ appVersion }: AboutTabProps) {
  const { t } = useTranslation('settings');
  const [updateState, setUpdateState] = useState<{
    enabled: boolean;
    updateAvailable: boolean;
    downloadedVersion: string | null;
    availableVersion: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isRunningInElectron()) {
      return;
    }
    const nestcafe = getNestCafe();
    if (!nestcafe) {
      return;
    }
    nestcafe
      .getUpdateState()
      .then(setUpdateState)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">{t('about.visitUs')}</div>
            <a
              href="https://github.com/snakex21/NestCafe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              github.com/snakex21/NestCafe
            </a>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t('about.versionLabel')}</div>
            <div className="font-medium">{appVersion || t('about.loading')}</div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
          {t('about.license')}
        </div>
      </div>

      {updateState?.enabled && updateState?.updateAvailable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-medium text-foreground">
              {updateState.downloadedVersion
                ? t('updates.downloadedStatus', 'Update downloaded: version {{version}}', {
                    version: updateState.downloadedVersion,
                  })
                : t('updates.availableStatus', 'Update available: version {{version}}', {
                    version: updateState.availableVersion,
                  })}
            </span>
          </div>
          {updateState.downloadedVersion && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                'updates.restartToInstallHint',
                'The update will be installed when you restart the app.',
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
