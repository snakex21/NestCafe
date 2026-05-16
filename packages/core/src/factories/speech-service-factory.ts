// ============================================================
// Speech service factory — speech-to-text and text-to-speech.
// Currently a stub: speech requires platform-specific APIs
// (Web Speech API in browser, system TTS in desktop).
// ============================================================

import type { SpeechServiceAPI, TranscriptionResult } from '../api/index.js';

export function createSpeechService(): SpeechServiceAPI {
  return {
    async transcribe(_audioData: ArrayBuffer): Promise<TranscriptionResult> {
      throw new Error(
        'Speech-to-text is not available. Requires Web Speech API (browser) or system STT (desktop).',
      );
    },

    async textToSpeech(_text: string): Promise<ArrayBuffer> {
      throw new Error(
        'Text-to-speech is not available. Requires Web Speech API (browser) or system TTS (desktop).',
      );
    },

    isAvailable(): boolean {
      return false;
    },
  };
}
