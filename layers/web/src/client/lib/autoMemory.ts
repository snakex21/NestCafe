import type { Task } from '@nestcafe_ai/agent-core/common';

export const AUTO_MEMORY_STORAGE_KEY = 'nestcafe:auto-memory:enabled';

const MEMORY_MANAGER_PROMPT_MARKER = '<memory-manager-task>';
const MEMORY_REPORT_OPEN = '<memory-report>';
const MEMORY_REPORT_CLOSE = '</memory-report>';
const MAX_MESSAGE_CHARS = 12_000;

export const MEMORY_NOTIFICATION_EVENT = 'nestcafe:memory-manager:notification';
export const MEMORY_HISTORY_CHANGED_EVENT = 'nestcafe:memory-manager:history-changed';
const MEMORY_HISTORY_STORAGE_KEY = 'nestcafe:memory-manager:history';

export interface MemoryFactReport {
  id?: string;
  page: string;
  content: string;
  category?: string;
  undone?: boolean;
}

export interface MemoryNotificationDetail {
  id: string;
  sourceTaskId: string;
  facts: MemoryFactReport[];
  createdAt: string;
  undone?: boolean;
}

export function isAutoMemoryEnabled(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const raw = window.localStorage.getItem(AUTO_MEMORY_STORAGE_KEY);
  return raw == null ? true : raw === 'true';
}

export function setAutoMemoryEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTO_MEMORY_STORAGE_KEY, enabled ? 'true' : 'false');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n...[ucięto dla pamięci]`;
}

export function buildMemoryManagerPrompt(task: Task): string {
  const messages = task.messages
    .filter((message) => message.type === 'user' || message.type === 'assistant')
    .map((message) => `## ${message.type}\n${message.content}`)
    .join('\n\n');

  return [
    MEMORY_MANAGER_PROMPT_MARKER,
    'Jesteś Memory Managerem w NestCafe. Działasz dyskretnie w tle.',
    '',
    'Z ostatniego zadania wyciągnij TYLKO wartościowe, trwałe informacje.',
    '',
    'Zapisuj jeśli:',
    '- to preferencja użytkownika, styl pracy albo zasada działania agenta,',
    '- to ważna informacja o projekcie, osobie, celu, decyzji albo terminie,',
    '- to fakt, który realnie pomoże w przyszłych rozmowach lub zadaniach.',
    '',
    'NIE zapisuj:',
    '- jednorazowych poleceń,',
    '- tymczasowych informacji,',
    '- zwykłej rozmowy towarzyskiej,',
    '- oczywistości i duplikatów.',
    '',
    'Jeśli nie ma nic wartościowego, nie zapisuj nic i zakończ zadanie.',
    'Jeśli zapisujesz, użyj update_wiki z odpowiednią stroną:',
    '- user-profile: trwałe fakty o użytkowniku,',
    '- preferences: preferencje i styl pracy,',
    '- projects: projekty i decyzje projektowe,',
    '- people: informacje o osobach,',
    '- timeline: ważne wydarzenia/datowane fakty,',
    '- agent-rules: zasady jak agent ma się zachowywać.',
    '',
    'Każdy wpis ma być krótki, po polsku, z datą i źródłem taska.',
    '',
    'Na samym końcu odpowiedz jednym krótkim raportem w tym formacie:',
    `${MEMORY_REPORT_OPEN}{"facts":[{"page":"preferences","category":"preference","content":"..."}]}${MEMORY_REPORT_CLOSE}`,
    `Jeśli nic nie zapisujesz: ${MEMORY_REPORT_OPEN}{"facts":[]}${MEMORY_REPORT_CLOSE}`,
    'Nie dodawaj żadnego tekstu poza raportem memory-report.',
    `Źródło: ${task.id}`,
    `Data: ${new Date().toISOString()}`,
    '',
    '<source-task>',
    `Prompt użytkownika:\n${truncate(task.prompt, 4000)}`,
    '',
    `Rozmowa:\n${truncate(messages, MAX_MESSAGE_CHARS)}`,
    '</source-task>',
    MEMORY_MANAGER_PROMPT_MARKER.replace('<', '</'),
  ].join('\n');
}

export function isMemoryManagerPrompt(prompt: string): boolean {
  return prompt.includes(MEMORY_MANAGER_PROMPT_MARKER);
}

function parseToolInput(input: unknown): Record<string, unknown> | null {
  if (!input) {
    return null;
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function extractFactsFromWikiToolCalls(task: Task): MemoryFactReport[] {
  return task.messages.flatMap((message) => {
    if (message.type !== 'tool' || !message.toolName?.includes('update_wiki')) {
      return [];
    }

    const input = parseToolInput(message.toolInput);
    const page = input?.page;
    const content = input?.content;
    if (typeof page !== 'string' || typeof content !== 'string' || !content.trim()) {
      return [];
    }

    return [{ page, content: content.trim() }];
  });
}

export function parseMemoryReport(task: Task): MemoryFactReport[] {
  const toolFacts = extractFactsFromWikiToolCalls(task);
  if (toolFacts.length > 0) {
    return toolFacts;
  }

  const content = task.messages
    .filter((message) => message.type === 'assistant')
    .map((message) => message.content)
    .join('\n');
  const start = content.lastIndexOf(MEMORY_REPORT_OPEN);
  const end = content.lastIndexOf(MEMORY_REPORT_CLOSE);
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  try {
    const raw = content.slice(start + MEMORY_REPORT_OPEN.length, end).trim();
    const parsed = JSON.parse(raw) as { facts?: MemoryFactReport[] };
    return Array.isArray(parsed.facts)
      ? parsed.facts.filter(
          (fact) => typeof fact.page === 'string' && typeof fact.content === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function createMemoryId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMemoryDetail(
  detail: Omit<MemoryNotificationDetail, 'id' | 'createdAt'> &
    Partial<Pick<MemoryNotificationDetail, 'id' | 'createdAt'>>,
): MemoryNotificationDetail {
  return {
    id: detail.id ?? createMemoryId('memory_note'),
    sourceTaskId: detail.sourceTaskId,
    facts: detail.facts.map((fact) => ({ ...fact, id: fact.id ?? createMemoryId('fact') })),
    createdAt: detail.createdAt ?? new Date().toISOString(),
    undone: detail.undone,
  };
}

export function loadMemoryHistory(): MemoryNotificationDetail[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(MEMORY_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as MemoryNotificationDetail[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMemoryHistory(history: MemoryNotificationDetail[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(MEMORY_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
  window.dispatchEvent(new Event(MEMORY_HISTORY_CHANGED_EVENT));
}

export function recordMemoryNotification(
  detail: Omit<MemoryNotificationDetail, 'id' | 'createdAt'> &
    Partial<Pick<MemoryNotificationDetail, 'id' | 'createdAt'>>,
): MemoryNotificationDetail {
  const normalized = normalizeMemoryDetail(detail);
  saveMemoryHistory([
    normalized,
    ...loadMemoryHistory().filter((item) => item.id !== normalized.id),
  ]);
  return normalized;
}

export function markMemoryNotificationUndone(notificationId: string): void {
  const history = loadMemoryHistory().map((item) =>
    item.id === notificationId
      ? { ...item, undone: true, facts: item.facts.map((fact) => ({ ...fact, undone: true })) }
      : item,
  );
  saveMemoryHistory(history);
}

export function dispatchMemoryNotification(
  detail: Omit<MemoryNotificationDetail, 'id' | 'createdAt'> &
    Partial<Pick<MemoryNotificationDetail, 'id' | 'createdAt'>>,
): void {
  if (typeof window === 'undefined' || detail.facts.length === 0) {
    return;
  }
  const normalized = recordMemoryNotification(detail);
  window.dispatchEvent(new CustomEvent(MEMORY_NOTIFICATION_EVENT, { detail: normalized }));
}
