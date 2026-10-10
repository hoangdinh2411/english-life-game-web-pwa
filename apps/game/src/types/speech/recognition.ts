export interface RecognitionResult {
  isFinal: boolean;
  0: {
    transcript: string;
  };
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    results: ArrayLike<RecognitionResult>;
  }) => void) | null;
  onerror: ((event: {
    error: string;
  }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface SpeechCallbacks {
  onListening(value: boolean): void;
  onTranscript(value: string): void;
  onInterim(value: string): void;
  onError(value: string): void;
}
export interface SpeechInput {
  start(): void;
  stop(): void;
  finish(): Promise<string | null>;
}
export interface SpeechWindow {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
}
