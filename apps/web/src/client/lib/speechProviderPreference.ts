export type SpeechProvider = 'local-whisper' | 'elevenlabs' | 'cohere';
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'cohere';

const SPEECH_PROVIDER_STORAGE_KEY = 'nestcafe:speechProvider';
const WHISPER_MODEL_STORAGE_KEY = 'nestcafe:whisperModel';

export function getSpeechProviderPreference(): SpeechProvider {
  if (typeof localStorage === 'undefined') return 'local-whisper';
  return localStorage.getItem(SPEECH_PROVIDER_STORAGE_KEY) === 'elevenlabs'
    ? 'elevenlabs' : 'local-whisper';
}

export function setSpeechProviderPreference(provider: SpeechProvider): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SPEECH_PROVIDER_STORAGE_KEY, provider);
}

export function getWhisperModelPreference(): WhisperModel {
  if (typeof localStorage === 'undefined') return 'small';
  return (localStorage.getItem(WHISPER_MODEL_STORAGE_KEY) as WhisperModel) || 'small';
}

export function setWhisperModelPreference(model: WhisperModel): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WHISPER_MODEL_STORAGE_KEY, model);
}
