import { app } from 'electron';
import path from 'path';
import { getLogCollector } from '../logging';
import type { TranscriptionError, TranscriptionResult } from './speechToText';

const LOCAL_WHISPER_MODEL_ID = 'Xenova/whisper-small';
const LOCAL_WHISPER_SAMPLE_RATE = 16000;
const WHISPER_MODELS: Record<string, string> = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base',
  small: 'Xenova/whisper-small',
  medium: 'Xenova/whisper-medium',
  cohere: 'onnx-community/cohere-transcribe-03-2026-ONNX',
};

type LocalWhisperPipeline = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string }>;

let transcriberPromise: Promise<LocalWhisperPipeline> | null = null;

function getFloat32Audio(audioData: Buffer): Float32Array {
  if (audioData.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error('Local Whisper expects Float32 PCM audio.');
  }
  return new Float32Array(
    audioData.buffer,
    audioData.byteOffset,
    audioData.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

async function loadLocalWhisper(modelId?: string): Promise<LocalWhisperPipeline> {
  if (transcriberPromise) {
    return transcriberPromise;
  }
  const selectedModel = WHISPER_MODELS[modelId || 'small'] || WHISPER_MODELS.small;

  transcriberPromise = (async () => {
    const logger = getLogCollector();
    logger.logEnv('INFO', `[LocalWhisper] Loading ${selectedModel}`);
    const { env, pipeline } = await import('@huggingface/transformers');
    env.cacheDir = path.join(app.getPath('userData'), 'whisper-models');
    env.allowRemoteModels = true;
    const transcriber = (await pipeline('automatic-speech-recognition', selectedModel, {
      dtype: 'q4',
    })) as unknown as LocalWhisperPipeline;
    logger.logEnv('INFO', `[LocalWhisper] Loaded ${selectedModel}`);
    return transcriber;
  })().catch((error) => {
    transcriberPromise = null;
    throw error;
  });

  return transcriberPromise;
}

export async function transcribeWithLocalWhisper(
  audioData: Buffer,
  modelId?: string,
): Promise<
  { success: true; result: TranscriptionResult } | { success: false; error: TranscriptionError }
> {
  const startedAt = Date.now();
  try {
    const audio = getFloat32Audio(audioData);
    if (audio.length === 0) {
      return {
        success: false,
        error: { code: 'EMPTY_AUDIO', message: 'No audio data was captured.' },
      };
    }
    const transcriber = await loadLocalWhisper(modelId);
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
    });
    return {
      success: true,
      result: {
        text: (output.text ?? '').trim(),
        duration: audio.length / LOCAL_WHISPER_SAMPLE_RATE,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    getLogCollector().logEnv('ERROR', '[LocalWhisper] Transcription failed', {
      error: message,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      success: false,
      error: {
        code: 'LOCAL_WHISPER_FAILED',
        message,
      },
    };
  }
}
