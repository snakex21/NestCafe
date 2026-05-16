import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowCircleDown, CheckCircle, Download, Warning } from '@phosphor-icons/react';
import { getNestCafe } from '@/lib/nestcafe';

interface UpdateNotification {
  type: 'available' | 'downloaded' | 'not-available' | 'error' | 'progress';
  version?: string;
  message?: string;
  percent?: number;
  autoDownload?: boolean;
  downloadUrl?: string;
}

export function UpdateBanner() {
  const [notification, setNotification] = useState<UpdateNotification | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const nestcafe = getNestCafe();

    const unsubs: (() => void)[] = [];

    if (nestcafe.onUpdateAvailable) {
      unsubs.push(
        nestcafe.onUpdateAvailable((data) => {
          setNotification({
            type: 'available',
            version: data.version,
            autoDownload: data.autoDownload,
            downloadUrl: (data as Record<string, unknown>).downloadUrl as string | undefined,
          });
          setDismissed(false);
        }),
      );
    }

    if (nestcafe.onUpdateDownloaded) {
      unsubs.push(
        nestcafe.onUpdateDownloaded((data) => {
          setNotification({ type: 'downloaded', version: data.version });
          setDismissed(false);
        }),
      );
    }

    if (nestcafe.onUpdateNotAvailable) {
      unsubs.push(
        nestcafe.onUpdateNotAvailable((data) => {
          setNotification({
            type: 'not-available',
            version: data.currentVersion,
          });
          setDismissed(false);
          // Auto-dismiss "no updates" after 5s
          setTimeout(() => setDismissed(true), 5000);
        }),
      );
    }

    if (nestcafe.onUpdateError) {
      unsubs.push(
        nestcafe.onUpdateError((data) => {
          setNotification({ type: 'error', message: data.message });
          setDismissed(false);
        }),
      );
    }

    if (nestcafe.onUpdateDownloadProgress) {
      unsubs.push(
        nestcafe.onUpdateDownloadProgress((data) => {
          setNotification({ type: 'progress', percent: data.percent });
          setDismissed(false);
        }),
      );
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, []);

  const handleRestart = async () => {
    try {
      await getNestCafe().quitAndInstall();
    } catch {
      /* best-effort */
    }
  };

  if (!notification || dismissed) {
    return null;
  }

  const isBanner = notification.type === 'available' || notification.type === 'downloaded';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -32 }}
        transition={{ duration: 0.2 }}
        className={`
          flex-shrink-0 border-b px-6 py-2.5
          ${
            notification.type === 'downloaded'
              ? 'border-green-500/30 bg-green-500/10'
              : notification.type === 'error'
                ? 'border-red-500/30 bg-red-500/10'
                : notification.type === 'not-available'
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : notification.type === 'progress'
                    ? 'border-accent/30 bg-accent/10'
                    : 'border-amber-500/30 bg-amber-500/10'
          }
        `}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2.5">
          {notification.type === 'downloaded' ? (
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : notification.type === 'error' ? (
            <Warning className="h-4 w-4 text-red-500 flex-shrink-0" />
          ) : notification.type === 'progress' ? (
            <ArrowCircleDown className="h-4 w-4 text-accent animate-bounce flex-shrink-0" />
          ) : notification.type === 'not-available' ? (
            <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Download className="h-4 w-4 text-amber-500 flex-shrink-0" />
          )}

          <span className="text-sm flex-1">
            {notification.type === 'downloaded' && (
              <>Update ready: version {notification.version} downloaded. Restart to apply.</>
            )}
            {notification.type === 'available' && (
              <>
                Version {notification.version} available.
                {notification.autoDownload
                  ? ' Downloading in background...'
                  : notification.downloadUrl
                    ? ' Click to download.'
                    : ' Enable auto-download in Settings.'}
              </>
            )}
            {notification.type === 'not-available' && (
              <>You&apos;re up to date! Version {notification.version} is the latest.</>
            )}
            {notification.type === 'error' && <>Update check failed: {notification.message}</>}
            {notification.type === 'progress' && (
              <>Downloading update... {notification.percent?.toFixed(0)}%</>
            )}
          </span>

          {isBanner && (
            <button
              onClick={
                notification.type === 'downloaded'
                  ? handleRestart
                  : notification.downloadUrl
                    ? () => getNestCafe().openExternal(notification.downloadUrl!)
                    : () => setDismissed(true)
              }
              className="flex-shrink-0 rounded-md bg-foreground/10 hover:bg-foreground/20 px-2.5 py-1 text-xs font-medium transition-colors"
            >
              {notification.type === 'downloaded'
                ? 'Restart Now'
                : notification.downloadUrl
                  ? 'Download'
                  : 'OK'}
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 rounded p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {notification.type === 'progress' && notification.percent !== undefined && (
          <div className="max-w-4xl mx-auto mt-1.5 h-1 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${notification.percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
