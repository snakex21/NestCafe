import type { IpcMainInvokeEvent } from 'electron';
import { getApiKey } from '../../store/secureStorage';
import { validateElevenLabsApiKey, transcribeAudio } from '../../services/speechToText';
import { transcribeWithLocalWhisper } from '../../services/localWhisper';
import { handle } from './utils';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

async function transcribeWithCohere(
  audioData: Buffer,
  mimeType?: string,
): Promise<
  | { success: true; result: { text: string; duration: number; timestamp: number } }
  | { success: false; error: { code: string; message: string } }
> {
  const apiKey = await getApiKey('cohere');
  if (!apiKey)
    return {
      success: false,
      error: { code: 'MISSING_API_KEY', message: 'Klucz Cohere nie skonfigurowany' },
    };
  const formData = new FormData();
  formData.append('file', new Blob([audioData], { type: mimeType || 'audio/webm' }), 'audio.webm');
  formData.append('model', 'cohere-transcribe');
  formData.append('language', 'pl');
  const res = await fetch('https://api.cohere.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    return { success: false, error: { code: 'API_ERROR', message: err.slice(0, 200) } };
  }
  const data = (await res.json()) as { text: string };
  return {
    success: true,
    result: { text: data.text?.trim() || '', duration: 0, timestamp: Date.now() },
  };
}

export function registerSpeechHandlers(): void {
  handle('speech:is-configured', async () => {
    const key = await getApiKey('elevenlabs');
    return Boolean(key && key.trim());
  });

  handle('speech:get-config', async () => {
    const key = await getApiKey('elevenlabs');
    return {
      enabled: Boolean(key && key.trim()),
      hasApiKey: Boolean(key),
      apiKeyPrefix: key ? key.substring(0, 8) + '...' : undefined,
    };
  });

  handle('speech:validate', async (_event: IpcMainInvokeEvent, apiKey?: string) => {
    return validateElevenLabsApiKey(apiKey);
  });

  handle(
    'speech:transcribe',
    async (
      _event: IpcMainInvokeEvent,
      audioData: ArrayBuffer,
      mimeType?: string,
      provider?: 'local-whisper' | 'elevenlabs' | 'cohere',
      whisperModel?: string,
    ) => {
      if (audioData?.byteLength > MAX_AUDIO_SIZE) throw new Error('Audio too large');
      const buffer = Buffer.from(audioData);
      if (provider === 'local-whisper') return transcribeWithLocalWhisper(buffer, whisperModel);
      if (provider === 'cohere') return transcribeWithCohere(buffer, mimeType);
      return transcribeAudio(buffer, mimeType);
    },
  );
}
