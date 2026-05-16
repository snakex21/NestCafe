import type { Dispatch, SetStateAction } from 'react';
import { getNestCafe } from '@/lib/nestcafe';
import type { FolderScanResult } from '@nestcafe_ai/agent-core/common';
import type { FolderEntry } from './types';
import { removeIndexedFolders } from './index-run-state';

export async function scanFolders(
  currentEntries: FolderEntry[],
  paths: string[],
  cancelled: boolean | (() => boolean),
  setEntries: Dispatch<SetStateAction<FolderEntry[]>>,
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  setEntries((prev) =>
    prev.map((e) => (paths.includes(e.path) ? { ...e, scanning: true, scanError: null } : e)),
  );

  try {
    const nestcafe = getNestCafe();
    const results = await nestcafe.folderIndexing.scanFolders(paths);
    removeIndexedFolders(results.filter((result) => result.error).map((result) => result.path));

    if (typeof cancelled === 'function' ? cancelled() : cancelled) {
      return;
    }

    setEntries((prev) =>
      prev.map((e) => {
        const result = results.find((r) => r.path === e.path);
        if (!result) {
          return e;
        }
        const typed = result as FolderScanResult;
        return {
          ...e,
          scanning: false,
          scanResult: typed.error ? null : typed,
          scanError: typed.error,
        };
      }),
    );
  } catch (err) {
    if (typeof cancelled === 'function' ? cancelled() : cancelled) {
      return;
    }
    setEntries((prev) =>
      prev.map((e) =>
        paths.includes(e.path) ? { ...e, scanning: false, scanError: String(err) } : e,
      ),
    );
  }
}
