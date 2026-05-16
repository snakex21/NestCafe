import { useState } from 'react';
import type { FileAttachmentInfo } from '@nestcafe_ai/agent-core/common';
import { createLogger } from '../../lib/logger';
import { MAX_FILES } from '../../lib/fileUtils';
import { getNestCafe } from '../../lib/nestcafe';

const logger = createLogger('ExecutionAttachments');

type Accomplish = ReturnType<typeof getNestCafe>;

export function useExecutionAttachments(nestcafe: Accomplish) {
  const [attachments, setAttachments] = useState<FileAttachmentInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [_dragCounter, setDragCounter] = useState(0);

  const removeAttachment = (fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== fileId));
  };

  const handlePickFiles = async () => {
    if (!nestcafe.pickFiles) {
      return;
    }
    try {
      const newFiles = await nestcafe.pickFiles();
      if (newFiles.length > 0) {
        setAttachments((prev) => {
          const remaining = MAX_FILES - prev.length;
          if (remaining <= 0) {
            return prev;
          }
          return [...prev, ...newFiles.slice(0, remaining)];
        });
      }
    } catch (error) {
      logger.error('Failed to pick files:', error);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setIsDragging(false);
    if (!nestcafe.processDroppedFiles) {
      logger.warn('Direct file drop is not supported in this environment yet.');
      return;
    }
    const extractedFiles: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          if (file) {
            extractedFiles.push(file);
          }
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        extractedFiles.push(e.dataTransfer.files[i]);
      }
    }
    if (extractedFiles.length === 0) {
      return;
    }
    const filePaths: string[] = [];
    for (const file of extractedFiles) {
      let filePath = 'path' in file ? (file as File & { path: string }).path : undefined;
      if (nestcafe.getFilePath) {
        try {
          filePath = nestcafe.getFilePath(file);
        } catch (err) {
          logger.error('Unexpected error', err);
        }
      }
      if (filePath && typeof filePath === 'string') {
        filePaths.push(filePath);
      }
    }
    if (filePaths.length === 0) {
      return;
    }
    try {
      const newAttachments = await nestcafe.processDroppedFiles(filePaths);
      if (newAttachments.length > 0) {
        setAttachments((prev) => {
          const remaining = MAX_FILES - prev.length;
          if (remaining <= 0) {
            return prev;
          }
          return [...prev, ...newAttachments.slice(0, remaining)];
        });
      }
    } catch (err) {
      logger.error('Failed to process dropped files:', err);
    }
  };

  return {
    attachments,
    setAttachments,
    isDragging,
    setIsDragging,
    setDragCounter,
    removeAttachment,
    handlePickFiles,
    handleDrop,
  };
}
