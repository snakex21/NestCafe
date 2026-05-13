import { useTranslation } from 'react-i18next';

interface AboutTabProps {
  appVersion: string;
}

export function AboutTab({ appVersion }: AboutTabProps) {
  const { t } = useTranslation('settings');
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
    </div>
  );
}
