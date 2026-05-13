import { handle } from './utils';
import { getDaemonClient } from '../../daemon-bootstrap';

export function registerModuleHandlers(): void {
  handle('module:list', async () => {
    const client = getDaemonClient();
    return client.call('module.list');
  });

  handle('module:get', async (_event, id: string) => {
    const client = getDaemonClient();
    return client.call('module.get', { id });
  });

  handle('module:install', async (_event, sourcePath: string) => {
    const client = getDaemonClient();
    return client.call('module.install', { sourcePath });
  });

  handle('module:enable', async (_event, id: string, enabled: boolean) => {
    const client = getDaemonClient();
    return client.call('module.enable', { id, enabled });
  });

  handle('module:uninstall', async (_event, id: string) => {
    const client = getDaemonClient();
    return client.call('module.uninstall', { id });
  });

  handle('module:getSettings', async (_event, moduleId: string) => {
    const client = getDaemonClient();
    return client.call('module.getSettings', { moduleId });
  });

  handle('module:setSetting', async (_event, moduleId: string, key: string, value: string) => {
    const client = getDaemonClient();
    return client.call('module.setSetting', { moduleId, key, value });
  });

  handle('module:getSource', async (_event, id: string) => {
    const client = getDaemonClient();
    return client.call('module.getSource', { id });
  });

  handle('module:discover', async () => {
    const client = getDaemonClient();
    return client.call('module.discover');
  });

  // Vision OCR — used by modules (e.g. ocr-viewer)
  handle(
    'vision:transcribe',
    async (
      _event,
      imageBase64: string,
      mimeType?: string,
      prompt?: string,
      providerId?: string,
      modelId?: string,
    ) => {
      const client = getDaemonClient();
      return client.call(
        'vision.transcribe',
        {
          imageBase64,
          mimeType,
          prompt,
          providerId,
          modelId,
        },
        { timeoutMs: 180_000 },
      );
    },
  );

  handle('ai:complete', async (_event, prompt: string) => {
    const client = getDaemonClient();
    return client.call('ai.complete', { prompt });
  });
}
