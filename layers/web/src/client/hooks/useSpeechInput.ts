/**
 * React Hook for managing speech-to-text input (orchestrator)
 * Delegates low-level recording to useSpeechRecorder.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getNestCafe } from '../lib/nestcafe';
import { decodeAudioForLocalWhisper } from '../lib/speechAudio';
import {
  getSpeechProviderPreference,
  getWhisperModelPreference,
} from '../lib/speechProviderPreference';
import { SpeechRecognitionError, UseSpeechInputOptions, UseSpeechInputState } from './speech-types';
import { useSpeechRecorder } from './useSpeechRecorder';

export { SpeechRecognitionError } from './speech-types';
export type { UseSpeechInputOptions, UseSpeechInputState } from './speech-types';

export function useSpeechInput(options: UseSpeechInputOptions = {}): UseSpeechInputState & {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  retry: () => Promise<void>;
  clearError: () => void;
} {
  const {
    onTranscriptionComplete,
    onRecordingStateChange,
    onError,
    maxDuration = 120000,
  } = options;

  const nestcafe = getNestCafe();
  const lastAudioDataRef = useRef<ArrayBuffer | null>(null);
  const configCheckIdRef = useRef(0);

  const [state, setState] = useState<UseSpeechInputState>({
    isRecording: false,
    isTranscribing: false,
    recordingDuration: 0,
    error: null,
    lastTranscription: null,
    isConfigured: false,
  });

  const transcribeAudio = useCallback(
    async (audioData: ArrayBuffer) => {
      const provider = getSpeechProviderPreference();
      const model = provider === 'local-whisper' ? getWhisperModelPreference() : undefined;
      if (provider === 'local-whisper') {
        const pcmAudio = await decodeAudioForLocalWhisper(audioData);
        return nestcafe.speechTranscribe(pcmAudio, 'audio/pcm;rate=16000', provider, model);
      }
      return nestcafe.speechTranscribe(audioData, 'audio/webm', provider, model);
    },
    [nestcafe],
  );

  const formatErrorMessage = useCallback((message: unknown): string => {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    configCheckIdRef.current++;
    const capturedId = configCheckIdRef.current;
    const provider = getSpeechProviderPreference();
    const configuredPromise =
      provider === 'local-whisper' ? Promise.resolve(true) : getNestCafe().speechIsConfigured();
    configuredPromise
      .then((configured) => {
        if (mounted && capturedId === configCheckIdRef.current) {
          setState((prev) => ({ ...prev, isConfigured: configured }));
        }
      })
      .catch(() => {
        // ignore errors from speechIsConfigured on mount
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const handleConfigUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ isConfigured?: boolean }>).detail;
      if (detail?.isConfigured !== undefined && mounted) {
        setState((prev) => ({ ...prev, isConfigured: detail.isConfigured as boolean }));
      }
      // Revalidate in the background to confirm the server-side state
      configCheckIdRef.current++;
      const capturedId = configCheckIdRef.current;
      const provider = getSpeechProviderPreference();
      const configuredPromise =
        provider === 'local-whisper' ? Promise.resolve(true) : getNestCafe().speechIsConfigured();
      configuredPromise
        .then((configured) => {
          if (mounted && capturedId === configCheckIdRef.current) {
            setState((prev) => ({ ...prev, isConfigured: configured }));
          }
        })
        .catch(() => {});
    };
    window.addEventListener('speech-config-updated', handleConfigUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('speech-config-updated', handleConfigUpdated);
    };
  }, []);

  const recorder = useSpeechRecorder({
    maxDuration,
    onError: (code, message, originalError) => {
      const speechError = new SpeechRecognitionError(code, message, originalError);
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isTranscribing: false,
        error: speechError,
        recordingDuration: 0,
      }));
      onError?.(speechError);
    },
    onStateChange: (recording) => {
      setState((prev) => ({ ...prev, isRecording: recording }));
      onRecordingStateChange?.(recording);
    },
    onDurationUpdate: (ms) => {
      setState((prev) => ({ ...prev, recordingDuration: ms }));
    },
  });

  const stopRecording = useCallback(async () => {
    if (!recorder.isCapturing) {
      return;
    }
    setState((prev) => ({ ...prev, isTranscribing: true }));
    try {
      const audioData = await recorder.stopCapture();
      if (!audioData) {
        setState((prev) => ({ ...prev, isTranscribing: false, recordingDuration: 0 }));
        return;
      }
      lastAudioDataRef.current = audioData;
      const result = await transcribeAudio(audioData);
      if (result.success) {
        setState((prev) => ({
          ...prev,
          isTranscribing: false,
          lastTranscription: result.result.text,
          error: null,
          recordingDuration: 0,
        }));
        onTranscriptionComplete?.(result.result.text);
      } else {
        const error = new SpeechRecognitionError(
          result.error.code,
          formatErrorMessage(result.error.message),
        );
        setState((prev) => ({ ...prev, isTranscribing: false, error, recordingDuration: 0 }));
        onError?.(error);
      }
    } catch (error) {
      const speechError = new SpeechRecognitionError(
        'TRANSCRIPTION_FAILED',
        error instanceof Error ? error.message : 'Failed to transcribe audio',
      );
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        error: speechError,
        recordingDuration: 0,
      }));
      onError?.(speechError);
    }
  }, [recorder, transcribeAudio, onTranscriptionComplete, onError, formatErrorMessage]);

  const startRecording = useCallback(async () => {
    if (recorder.isCapturing || state.isTranscribing) {
      return;
    }
    lastAudioDataRef.current = null;
    if (!state.isConfigured) {
      const error = new SpeechRecognitionError(
        'NOT_CONFIGURED',
        'Speech input is not configured. Please enable Local Whisper or add an ElevenLabs API key in settings.',
      );
      setState((prev) => ({ ...prev, error }));
      onError?.(error);
      return;
    }
    setState((prev) => ({ ...prev, error: null, recordingDuration: 0 }));
    await recorder.startCapture();
  }, [recorder, state.isTranscribing, state.isConfigured, onError]);

  const cancelRecording = useCallback(() => {
    if (!recorder.isCapturing) {
      return;
    }
    recorder.cancelCapture();
    lastAudioDataRef.current = null;
    setState((prev) => ({ ...prev, isRecording: false, error: null, recordingDuration: 0 }));
  }, [recorder]);

  const retry = useCallback(async () => {
    if (!lastAudioDataRef.current || state.isTranscribing || state.isRecording) {
      return;
    }
    try {
      setState((prev) => ({ ...prev, isTranscribing: true, error: null }));
      const result = await transcribeAudio(lastAudioDataRef.current);
      if (result.success) {
        setState((prev) => ({
          ...prev,
          isTranscribing: false,
          lastTranscription: result.result.text,
          error: null,
        }));
        onTranscriptionComplete?.(result.result.text);
      } else {
        const error = new SpeechRecognitionError(
          result.error.code,
          formatErrorMessage(result.error.message),
        );
        setState((prev) => ({ ...prev, isTranscribing: false, error }));
        onError?.(error);
      }
    } catch (error) {
      const speechError = new SpeechRecognitionError(
        'TRANSCRIPTION_FAILED',
        error instanceof Error ? error.message : 'Failed to transcribe audio',
      );
      setState((prev) => ({ ...prev, isTranscribing: false, error: speechError }));
      onError?.(speechError);
    }
  }, [
    state.isTranscribing,
    state.isRecording,
    onTranscriptionComplete,
    onError,
    transcribeAudio,
    formatErrorMessage,
  ]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.isRecording) {
        event.preventDefault();
        cancelRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isRecording, cancelRecording]);

  return { ...state, startRecording, stopRecording, cancelRecording, retry, clearError };
}
