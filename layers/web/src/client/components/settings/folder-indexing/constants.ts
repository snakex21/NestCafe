import type { TaskStatus } from '@nestcafe_ai/agent-core/common';
import { getNestCafe } from '@/lib/nestcafe';
import type { PredefinedLocation, CategoryInfo } from './types';

export const PREDEFINED_LOCATIONS: PredefinedLocation[] = [
  {
    id: 'desktop',
    label: 'Pulpit',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('desktop');
      }
      return null;
    },
  },
  {
    id: 'documents',
    label: 'Dokumenty',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('documents');
      }
      return null;
    },
  },
  {
    id: 'downloads',
    label: 'Pobrane',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('downloads');
      }
      return null;
    },
  },
  { id: 'drive-d', label: 'Dysk D:\\', getPath: async () => 'D:\\' },
  { id: 'drive-e', label: 'Dysk E:\\', getPath: async () => 'E:\\' },
];

export const CATEGORIES: CategoryInfo[] = [
  { key: 'pdf', label: 'PDF', color: 'bg-red-100 text-red-700' },
  { key: 'docx', label: 'DOCX', color: 'bg-blue-100 text-blue-700' },
  { key: 'txt', label: 'TXT', color: 'bg-gray-100 text-gray-700' },
  { key: 'md', label: 'MD', color: 'bg-purple-100 text-purple-700' },
  { key: 'mp4', label: 'MP4', color: 'bg-green-100 text-green-700' },
  { key: 'png', label: 'PNG', color: 'bg-amber-100 text-amber-700' },
  { key: 'jpg', label: 'JPG', color: 'bg-orange-100 text-orange-700' },
  { key: 'mp3', label: 'MP3', color: 'bg-pink-100 text-pink-700' },
  { key: 'other', label: 'Inne', color: 'bg-zinc-100 text-zinc-600' },
];

export const TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);

export const INDEX_PROGRESS_STORAGE_KEY = 'nestcafe:folder-indexing:progress';
export const INDEXED_FOLDERS_STORAGE_KEY = 'nestcafe:folder-indexing:indexed-folders';
export const INDEXED_FOLDERS_CHANGED_EVENT = 'nestcafe:folder-indexing:indexed-folders-changed';
