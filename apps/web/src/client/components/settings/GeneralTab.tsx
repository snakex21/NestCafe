import { useTranslation } from 'react-i18next';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { DebugSection } from '@/components/settings/DebugSection';
import { DaemonSection } from '@/components/settings/DaemonSection';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { WindowCloseSection } from '@/components/settings/WindowCloseSection';
import { BackupRestoreSection } from '@/components/settings/BackupRestoreSection';
import { AppearanceCustomization } from '@/components/settings/AppearanceCustomization';
import { UpdateSection } from '@/components/settings/UpdateSection';

interface GeneralTabProps {
  notificationsEnabled: boolean;
  onNotificationsToggle: () => void;
  debugMode: boolean;
  onDebugToggle: () => void;
}

export function GeneralTab({
  notificationsEnabled,
  onNotificationsToggle,
  debugMode,
  onDebugToggle,
}: GeneralTabProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <ThemeSelector />
      <AppearanceCustomization />
      <LanguageSelector />

      <section>
        <NotificationsSection enabled={notificationsEnabled} onToggle={onNotificationsToggle} />
      </section>

      <section>
        <WindowCloseSection />
      </section>

      <section>
        <BackupRestoreSection />
      </section>

      <UpdateSection />

      <section>
        <DaemonSection />
      </section>

      <section>
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          {t('developer.title')}
        </h4>
        <DebugSection debugMode={debugMode} onDebugToggle={onDebugToggle} />
      </section>
    </div>
  );
}
