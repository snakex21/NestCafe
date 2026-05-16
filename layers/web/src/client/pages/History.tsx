import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/layout/Header';
import TaskHistory from '../components/history/TaskHistory';
import { useTaskStore } from '../stores/taskStore';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';

export default function HistoryPage() {
  const { t } = useTranslation('history');
  const { t: tCommon } = useTranslation('common');
  const tasks = useTaskStore((s) => s.tasks);
  const clearHistory = useTaskStore((s) => s.clearHistory);
  const [clearOpen, setClearOpen] = useState(false);

  const handleClearAll = async () => {
    try {
      await clearHistory();
    } catch (error) {
      console.error('Failed to clear task history:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text">{t('title')}</h1>
          {tasks.length > 0 && (
            <button
              onClick={() => setClearOpen(true)}
              className="text-sm text-text-muted hover:text-danger transition-colors"
            >
              {tCommon('buttons.clearAll')}
            </button>
          )}
        </div>
        <ConfirmationDialog
          open={clearOpen}
          onOpenChange={setClearOpen}
          title={tCommon('buttons.clearAll')}
          description={t('confirmClear')}
          confirmLabel={tCommon('buttons.deleteAll')}
          cancelLabel={tCommon('buttons.cancel')}
          onConfirm={handleClearAll}
        />
        <TaskHistory showTitle={false} />
      </main>
    </div>
  );
}
