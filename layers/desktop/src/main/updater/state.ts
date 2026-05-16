/**
 * Module-level mutable state for the auto-updater, shared between the event
 * handlers registered in updater/index.ts, the menu's getUpdateState() query,
 * and checkForUpdates()'s "should we notify no-update?" flag.
 *
 * Kept in its own module so updater/index.ts stays under the per-file LOC cap,
 * and so tests can read/reset state without poking at initUpdater's internals.
 */

import type { BrowserWindow } from 'electron';
import type { UpdateInfo } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let downloadedVersion: string | null = null;
let updateAvailable: UpdateInfo | null = null;
let onUpdateDownloadedCallback: (() => void) | null = null;
let userCheckInFlight = false;
let autoCheckEnabled = true;
let autoDownloadEnabled = true;
let autoInstallEnabled = true;

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setDownloadedVersion(v: string | null): void {
  downloadedVersion = v;
}
export function getDownloadedVersion(): string | null {
  return downloadedVersion;
}

export function setUpdateAvailable(info: UpdateInfo | null): void {
  updateAvailable = info;
}

export function setUserCheckInFlight(v: boolean): void {
  userCheckInFlight = v;
}
export function getUserCheckInFlight(): boolean {
  return userCheckInFlight;
}

export function setOnUpdateDownloaded(callback: () => void): void {
  onUpdateDownloadedCallback = callback;
}
export function invokeOnUpdateDownloaded(): void {
  onUpdateDownloadedCallback?.();
}

export function getUpdateState(): {
  updateAvailable: boolean;
  downloadedVersion: string | null;
  availableVersion: string | null;
} {
  return {
    updateAvailable: !!updateAvailable,
    downloadedVersion,
    availableVersion: updateAvailable?.version ?? null,
  };
}

export function setAutoCheckEnabled(v: boolean): void {
  autoCheckEnabled = v;
}
export function getAutoCheckEnabled(): boolean {
  return autoCheckEnabled;
}

export function setAutoDownloadEnabled(v: boolean): void {
  autoDownloadEnabled = v;
}
export function getAutoDownloadEnabled(): boolean {
  return autoDownloadEnabled;
}

export function setAutoInstallEnabled(v: boolean): void {
  autoInstallEnabled = v;
}
export function getAutoInstallEnabled(): boolean {
  return autoInstallEnabled;
}

/** Send an update-related notification to the renderer window. */
export function notifyRenderer(channel: string, data?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
    } catch {
      /* window torn down between check and send */
    }
  }
}
