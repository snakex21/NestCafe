const LOCAL_WHISPER_SAMPLE_RATE = 16000;

function copyFloat32Buffer(data: Float32Array): ArrayBuffer {
  const copy = new Float32Array(data.length);
  copy.set(data);
  return copy.buffer;
}

export async function decodeAudioForLocalWhisper(audioData: ArrayBuffer): Promise<ArrayBuffer> {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor || !window.OfflineAudioContext) {
    throw new Error('Local Whisper transcription requires browser audio decoding support.');
  }

  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(audioData.slice(0));
    const frameCount = Math.max(1, Math.ceil(decoded.duration * LOCAL_WHISPER_SAMPLE_RATE));
    const offlineContext = new OfflineAudioContext(1, frameCount, LOCAL_WHISPER_SAMPLE_RATE);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start(0);
    const rendered = await offlineContext.startRendering();
    return copyFloat32Buffer(rendered.getChannelData(0));
  } finally {
    await audioContext.close().catch(() => {});
  }
}

export { LOCAL_WHISPER_SAMPLE_RATE };
