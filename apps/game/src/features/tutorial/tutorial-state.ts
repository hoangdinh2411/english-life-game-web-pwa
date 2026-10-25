import { tutorialPages } from './tutorial-pages';

export type TutorialSource = 'first-run' | 'menu';
export type TutorialReturnSurface = 'game' | 'menu';
export type TutorialNavigationAction = 'previous' | 'next';
export type TutorialKeyboardAction = TutorialNavigationAction | 'close';

type TutorialStorage = Pick<Storage, 'getItem' | 'setItem'>;
const tutorialSeenKey = 'movementTutorialSeen';

export function tutorialPageAfter(pageIndex: number, action: TutorialNavigationAction): number {
  const offset = action === 'next' ? 1 : -1;
  return Math.min(tutorialPages.length - 1, Math.max(0, pageIndex + offset));
}

export function tutorialPrimaryLabel(pageIndex: number): 'Next' | 'Start Exploring' {
  return pageIndex === tutorialPages.length - 1 ? 'Start Exploring' : 'Next';
}

export function tutorialReturnSurface(source: TutorialSource): TutorialReturnSurface {
  return source === 'menu' ? 'menu' : 'game';
}

export function tutorialKeyboardAction(key: string, editingFormControl: boolean): TutorialKeyboardAction | null {
  if (editingFormControl) return null;
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Escape') return 'close';
  return null;
}

export function isTutorialFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select') || target.isContentEditable);
}

export function movementTutorialSeen(storage?: TutorialStorage): boolean {
  try {
    const resolved = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    return resolved?.getItem(tutorialSeenKey) === '1';
  }
  catch { return false; }
}

export function completeMovementTutorial(storage?: TutorialStorage): void {
  try { storage?.setItem(tutorialSeenKey, '1'); }
  catch { /* The tutorial may appear again when browser storage is unavailable. */ }
}
