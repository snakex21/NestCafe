import type { FileAttachmentInfo } from '@nestcafe_ai/agent-core/common';
import type { IndexFileItem } from './types';

export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function buildFolderPageName(folderPath: string): string {
  const normalized = folderPath
    .replace(/^[a-zA-Z]:/, (drive) => drive.replace(':', ''))
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 90);
  return `folder-index--${normalized || 'root'}`;
}

export function getParentDirectory(filePath: string): string | undefined {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  if (index <= 0) {
    return undefined;
  }
  return filePath.slice(0, index);
}

export function getAttachmentType(filePath: string): FileAttachmentInfo['type'] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['txt', 'md', 'json', 'csv', 'xml', 'html'].includes(ext)) {
    return 'text';
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'ps1', 'sh', 'bat', 'css', 'yml', 'yaml'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

export function buildAttachmentInfo(filePath: string): FileAttachmentInfo {
  return {
    id: `folder-index-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: getFileName(filePath),
    path: filePath,
    type: getAttachmentType(filePath),
    size: 0,
  };
}

export function buildSingleFileIndexPrompt(item: IndexFileItem, current: number, total: number): string {
  return [
    '<folder-indexing-file>',
    `Indeksujesz plik ${current}/${total}.`,
    `Folder źródłowy: ${item.folderPath}`,
    `Strona wiki folderu/szufladki: ${item.folderPage}`,
    `Ścieżka pliku: ${item.filePath}`,
    '',
    'To zadanie jest niezależne od innych plików — użyj czystego kontekstu tylko dla tego pliku.',
    'Otwórz/odczytaj ten konkretny plik. Jeśli jest załączony jako PDF/obraz, przeanalizuj załącznik.',
    'Wyciągnij tytuł, temat, ważne fakty, osoby/projekty/daty i 1-2 zdaniowe podsumowanie.',
    'Na końcu KONIECZNIE zapisz wynik do szufladki folderu narzędziem update_wiki:',
    `update_wiki(page="${item.folderPage}", mode="append", content="## [nazwa pliku]\nŚcieżka: [ścieżka]\nTyp: [typ]\nPodsumowanie: [podsumowanie i kluczowe fakty]")`,
    'Dodatkowo zaktualizuj ogólną mapę indeksu:',
    `update_wiki(page="file-index", mode="append", content="${item.folderPath} -> ${item.folderPage}")`,
    'Jeśli pliku nie da się odczytać, też zapisz krótką informację do szufladki folderu, że został pominięty i dlaczego.',
    'Nie pytaj użytkownika o potwierdzenie.',
    '</folder-indexing-file>',
  ].join('\n');
}
