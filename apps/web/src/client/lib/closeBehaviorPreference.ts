export type CloseBehavior = 'keep-daemon' | 'stop-daemon';

const CLOSE_CONFIRM_PROMPT_STORAGE_KEY = 'nestcafe:showCloseConfirmDialog';

export function getShowCloseConfirmDialog(): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  return localStorage.getItem(CLOSE_CONFIRM_PROMPT_STORAGE_KEY) !== 'false';
}

export function setShowCloseConfirmDialog(show: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(CLOSE_CONFIRM_PROMPT_STORAGE_KEY, show ? 'true' : 'false');
}

export function normalizeCloseBehavior(value: string | null | undefined): CloseBehavior {
  return value === 'stop-daemon' ? 'stop-daemon' : 'keep-daemon';
}
