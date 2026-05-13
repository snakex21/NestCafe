import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getNestCafe, type BackupSectionOptions } from '@/lib/nestcafe';

type BackupStatus = { tone: 'success' | 'error' | 'muted'; message: string } | null;

const DEFAULT_OPTIONS: BackupSectionOptions = {
  settings: true,
  providers: true,
  apiKeys: true,
  workspaces: true,
  skills: true,
};

export function BackupRestoreSection() {
  const { t } = useTranslation('settings');
  const nestcafe = getNestCafe();
  const [options, setOptions] = useState<BackupSectionOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [status, setStatus] = useState<BackupStatus>(null);

  const rows = useMemo(
    () =>
      (['settings', 'providers', 'apiKeys', 'workspaces', 'skills'] as const).map((key) => ({
        key,
        title: t(`backup.sections.${key}.title`),
        description: t(`backup.sections.${key}.description`),
      })),
    [t],
  );

  const setOption = (key: keyof BackupSectionOptions, checked: boolean) => {
    setOptions((current) => ({ ...current, [key]: checked }));
  };

  const handleExport = async () => {
    setBusy('export');
    setStatus(null);
    try {
      const result = await nestcafe.exportBackup(options);
      if (!result.success && result.reason === 'cancelled') {
        setStatus({ tone: 'muted', message: t('backup.cancelled') });
        return;
      }
      setStatus({ tone: 'success', message: t('backup.exportSuccess', { path: result.path }) });
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : t('backup.error'),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy('import');
    setStatus(null);
    try {
      const result = await nestcafe.importBackup(options);
      if (!result.success && result.reason === 'cancelled') {
        setStatus({ tone: 'muted', message: t('backup.cancelled') });
        return;
      }
      setStatus({ tone: 'success', message: t('backup.importSuccess') });
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : t('backup.error'),
      });
    } finally {
      setBusy(null);
    }
  };

  const statusClass = {
    success: 'text-success',
    error: 'text-destructive',
    muted: 'text-muted-foreground',
  }[status?.tone ?? 'muted'];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h4 className="text-sm font-medium text-foreground">{t('backup.title')}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{t('backup.description')}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 rounded-md bg-muted/30 p-3"
          >
            <div>
              <div className="text-sm font-medium text-foreground">{row.title}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              size="sm"
              checked={options[row.key]}
              onCheckedChange={(checked) => setOption(row.key, checked)}
              ariaLabel={row.title}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleExport} disabled={busy !== null} className="gap-2">
          <DownloadSimple className="h-4 w-4" />
          {busy === 'export' ? t('backup.exporting') : t('backup.export')}
        </Button>
        <Button variant="outline" onClick={handleImport} disabled={busy !== null} className="gap-2">
          <UploadSimple className="h-4 w-4" />
          {busy === 'import' ? t('backup.importing') : t('backup.import')}
        </Button>
      </div>

      {status && <p className={`mt-3 text-xs ${statusClass}`}>{status.message}</p>}
    </div>
  );
}
