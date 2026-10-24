export type QuickRestPhase = 'darkening' | 'resting' | 'waking' | null;

export interface QuickRestTransitionOptions<T> {
  request: () => Promise<T>;
  onPhase: (phase: QuickRestPhase) => void;
  wait: (milliseconds: number) => Promise<void>;
  reducedMotion: boolean;
}

const REST_DURATION_MS = 5000;
const FADE_DURATION_MS = 750;
const REDUCED_FADE_DURATION_MS = 100;

export async function runQuickRestTransition<T>({ request, onPhase, wait, reducedMotion }: QuickRestTransitionOptions<T>): Promise<T> {
  const result = await request();
  const fadeDuration = reducedMotion ? REDUCED_FADE_DURATION_MS : FADE_DURATION_MS;
  onPhase('darkening');
  await wait(fadeDuration);
  onPhase('resting');
  await wait(REST_DURATION_MS);
  onPhase('waking');
  await wait(fadeDuration);
  onPhase(null);
  return result;
}
