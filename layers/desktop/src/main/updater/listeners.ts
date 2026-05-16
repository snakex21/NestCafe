/**
 * electron-updater event-handler registration. Split out so updater/index.ts
 * can stay focused on lifecycle orchestration (init, setFeedURL, check, quit)
 * and stay under the per-file LOC cap.
 *
 * Handlers mutate state through updater/state.ts and fire analytics + logs
 * through the standard wrappers — nothing here is updater-internal state.
 */

import type { AppUpdater, UpdateInfo } from 'electron-updater';
import { app } from 'electron';
import { showUpdateCheckFailedDialog, showUpdateReadyDialog } from './dialogs';
import { getFeedUrl } from './feed-config';
import { log } from './logger';
import { isTrustedUpdateInfo } from './origin';
import {
  getMainWindow,
  getUserCheckInFlight,
  invokeOnUpdateDownloaded,
  setDownloadedVersion,
  setUserCheckInFlight,
  setUpdateAvailable,
  getAutoDownloadEnabled,
  notifyRenderer,
} from './state';

/**
 * Wire the five electron-updater lifecycle events. Caller passes `quitAndInstall`
 * so the update-downloaded dialog's "Restart Now" button can trigger it without
 * a circular import.
 */
export function registerAutoUpdaterListeners(
  autoUpdater: AppUpdater,
  quitAndInstall: () => Promise<void>,
): void {
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const shouldNotifyUpdateAvailable = getUserCheckInFlight();
    setUserCheckInFlight(false);
    if (!isTrustedUpdateInfo(info, getFeedUrl())) {
      setUpdateAvailable(null);
      log('WARN', '[Updater] Rejected update with untrusted download URL', {
        version: info.version,
      });
      if (shouldNotifyUpdateAvailable) {
        void showUpdateCheckFailedDialog();
      }
      return;
    }
    setUpdateAvailable(info);
    log('INFO', '[Updater] update-available', { version: info.version });

    const autoDownload = getAutoDownloadEnabled();
    // Notify renderer so it can show an in-app banner instead of a system dialog
    notifyRenderer('update:available', {
      version: info.version,
      autoDownload,
      userInitiated: shouldNotifyUpdateAvailable,
    });

    if (autoDownload) {
      void autoUpdater.downloadUpdate().catch((error: Error) => {
        log('ERROR', '[Updater] downloadUpdate failed', { err: error.message });
      });
    }
  });

  autoUpdater.on('update-not-available', async () => {
    if (!getUserCheckInFlight()) {
      return;
    }
    setUserCheckInFlight(false);
    notifyRenderer('update:not-available', { currentVersion: app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.setProgressBar(progress.percent / 100);
    notifyRenderer('update:download-progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log('INFO', '[Updater] update-downloaded', { version: info.version });
    getMainWindow()?.setProgressBar(-1);
    setDownloadedVersion(info.version);
    invokeOnUpdateDownloaded();
    notifyRenderer('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (error: Error) => {
    setUserCheckInFlight(false);
    getMainWindow()?.setProgressBar(-1);
    log('ERROR', '[Updater] error', { err: error.message });
    notifyRenderer('update:error', { message: error.message });
  });
}
