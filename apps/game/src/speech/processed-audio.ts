import type { Preferences } from '../features/hud/preferences';
import type { RecordedAudio } from '../types/speech/narration';

type PlaybackSettings = Pick<Preferences, 'speechRate' | 'speechPitch'>;

interface SoundTouchOutput extends AudioNode {
  pitch: AudioParam;
  playbackRate: AudioParam;
}

let sharedContext: AudioContext | null = null;
let registration: Promise<void> | null = null;

export function createCorsAudioElement(
  url: string,
  createAudio: () => HTMLAudioElement = () => new Audio(),
): HTMLAudioElement {
  const audio = createAudio();
  audio.crossOrigin = 'anonymous';
  audio.src = url;
  return audio;
}

function context(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext();
  return sharedContext;
}

async function connectProcessor(audio: HTMLAudioElement, settings: PlaybackSettings): Promise<AudioNode> {
  const audioContext = context();
  const [{ SoundTouchNode }, { default: processorUrl }] = await Promise.all([
    import('@soundtouchjs/audio-worklet'),
    import('@soundtouchjs/audio-worklet/processor?url'),
  ]);
  registration ??= SoundTouchNode.register(audioContext, processorUrl);
  await registration;
  if (audioContext.state === 'suspended') await audioContext.resume();
  const processor = new SoundTouchNode({ context: audioContext }) as SoundTouchOutput;
  const source = audioContext.createMediaElementSource(audio);
  audio.preservesPitch = false;
  audio.playbackRate = settings.speechRate;
  processor.playbackRate.value = settings.speechRate;
  processor.pitch.value = settings.speechPitch;
  try {
    source.connect(processor).connect(audioContext.destination);
  } catch (error: unknown) {
    source.connect(audioContext.destination);
    throw error;
  }
  return processor;
}

export function createProcessedAudio(url: string, settings: PlaybackSettings): RecordedAudio {
  const audio = createCorsAudioElement(url);
  let output: AudioNode | null = null;
  return {
    get currentTime() { return audio.currentTime; },
    set currentTime(value) { audio.currentTime = value; },
    get duration() { return audio.duration; },
    get onended() { return audio.onended; },
    set onended(value) { audio.onended = value; },
    get onerror() { return audio.onerror; },
    set onerror(value) { audio.onerror = value; },
    get ontimeupdate() { return audio.ontimeupdate; },
    set ontimeupdate(value) { audio.ontimeupdate = value; },
    async play() {
      try {
        output = await connectProcessor(audio, settings);
      } catch {
        audio.preservesPitch = true;
        audio.playbackRate = settings.speechRate;
      }
      return audio.play();
    },
    pause() {
      audio.pause();
      output?.disconnect();
      output = null;
    },
  };
}

export function resetSharedAudioContextForTests(): void {
  sharedContext = null;
  registration = null;
}
