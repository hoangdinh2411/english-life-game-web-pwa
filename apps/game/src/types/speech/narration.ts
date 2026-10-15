export type VoiceGender = 'female' | 'male';
export type Utterance = SpeechSynthesisUtterance;
export type Synthesis = Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel'>;
export type RecordedAudio = Pick<HTMLAudioElement, 'currentTime' | 'duration' | 'onended' | 'onerror' | 'ontimeupdate' | 'play' | 'pause'>;
export interface NarrationCallbacks {
  onSpeaking(value: boolean): void;
  onError(message: string): void;
  onProgress?(value: number): void;
}
export interface Narrator {
  speak(text: string, gender?: VoiceGender): void;
  stop(): void;
}
export interface RecordedNarrator {
  speak(text: string, gender?: VoiceGender): void;
  stop(): void;
}
export interface StationAudioClip {
  text: string;
  gender: VoiceGender;
  asset: string;
}
export type StationAudioCatalog = readonly StationAudioClip[];
