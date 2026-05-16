import type { ProviderId } from '@nestcafe_ai/agent-core/common';
import type { SettingsTabId } from '@/components/layout/settings-tabs';

export const OPEN_SETTINGS_EVENT = 'nestcafe:open-settings';

export interface OpenSettingsDetail {
  initialTab?: SettingsTabId;
  initialProvider?: ProviderId;
}

export function openSettingsView(detail: OpenSettingsDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, { detail }));
}
