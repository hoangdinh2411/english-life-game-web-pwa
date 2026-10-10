import type { Recognition, SpeechCallbacks, SpeechInput } from '../types/speech/recognition';

export function createSpeechInput(createRecognition: () => Recognition | null, callbacks: SpeechCallbacks): SpeechInput {
  let recognition: Recognition | null = null;
  let active = false;
  let keepListening = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let completed = '';
  let finishing: Promise<string | null> | null = null;
  let resolveFinish: ((transcript: string | null) => void) | null = null;
  const settleFinish = (transcript: string | null): void => {
    const resolve = resolveFinish;
    resolveFinish = null; finishing = null;
    resolve?.(transcript);
  };
  const join = (...parts: string[]): string => parts.map(part => part.trim()).filter(Boolean).join(' ');
  const clearRestart = () => {
    if (restartTimer !== null) globalThis.clearTimeout(restartTimer);
    restartTimer = null;
  };
  const detach = (current: Recognition): void => {
    current.onresult = null; current.onerror = null; current.onend = null;
  };
  const stop = () => {
    active = false; keepListening = false; clearRestart();
    if (recognition) { const current = recognition; recognition = null; detach(current); current.abort(); }
    callbacks.onListening(false); callbacks.onInterim('');
    settleFinish(null);
  };
  const beginSession = () => {
    if (!keepListening) return;
    let current;
    try { current = createRecognition(); }
    catch { callbacks.onError('The microphone could not start. You can type instead.'); stop(); return; }
    if (!current) { callbacks.onError('Speech recognition is unavailable here. Please type your answer.'); stop(); return; }
    recognition = current;
    let sessionFinal = '';
    current.lang = 'en-US'; current.continuous = true; current.interimResults = true;
    current.onresult = event => {
      if (!active || recognition !== current) return;
      const final: string[] = [], interim: string[] = [];
      // Result lists are cumulative within one browser recognition session.
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (!result) continue;
        (result.isFinal ? final : interim).push(result[0].transcript);
      }
      sessionFinal = join(...final);
      if (sessionFinal) callbacks.onTranscript(join(completed, sessionFinal));
      callbacks.onInterim(join(...interim));
    };
    current.onerror = event => {
      if (!active || recognition !== current) return;
      // Silence is a normal session boundary; onend will restart listening.
      if (event.error === 'no-speech') return;
      const messages: Record<string, string> = { 'not-allowed': 'Microphone access was denied. You can type your answer.', 'service-not-allowed': 'Speech recognition access was denied. You can type your answer.', network: 'Speech recognition lost its connection. You can type instead.' };
      callbacks.onError(messages[event.error] ?? 'Speech recognition stopped. Try again or type.'); stop();
    };
    current.onend = () => {
      if (recognition !== current) return;
      completed = join(completed, sessionFinal);
      recognition = null; detach(current); callbacks.onInterim('');
      if (keepListening) {
        // Browsers may end even continuous recognition after a pause or timeout.
        restartTimer = globalThis.setTimeout(() => { restartTimer = null; beginSession(); }, 100);
      } else { active = false; callbacks.onListening(false); settleFinish(completed); }
    };
    try { current.start(); }
    catch { callbacks.onError('The microphone could not start. You can type instead.'); stop(); }
  };
  return {
    start() {
      stop(); completed = ''; active = true; keepListening = true;
      callbacks.onListening(true); beginSession();
    },
    stop,
    finish() {
      if (finishing) return finishing;
      if (!active) return Promise.resolve(completed);
      const result = new Promise<string | null>(resolve => { resolveFinish = resolve; });
      finishing = result;
      keepListening = false; clearRestart();
      // Keep result callbacks alive until the browser delivers its final text.
      if (recognition && active) {
        try { recognition.stop(); }
        catch { callbacks.onError('Speech recognition could not finish. You can edit the transcript or type instead.'); stop(); }
      }
      else { active = false; callbacks.onListening(false); callbacks.onInterim(''); settleFinish(completed); }
      return result;
    },
  };
}
