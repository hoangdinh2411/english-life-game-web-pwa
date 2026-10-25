import { useEffect, useState } from 'react';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { tutorialPages } from './tutorial-pages';
import {
  completeMovementTutorial,
  isTutorialFormControl,
  tutorialKeyboardAction,
  tutorialPageAfter,
  tutorialPrimaryLabel,
  type TutorialSource,
} from './tutorial-state';

export interface MovementTutorialProps {
  playerName: string;
  sound: boolean;
  source: TutorialSource;
  onClose: () => void;
}

function deviceStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function MovementTutorial({ playerName, source, onClose }: MovementTutorialProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = tutorialPages[pageIndex] ?? tutorialPages[0];
  const finalPage = pageIndex === tutorialPages.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = tutorialKeyboardAction(event.key, isTutorialFormControl(event.target));
      if (!action) return;
      event.preventDefault();
      if (action === 'close') onClose();
      else setPageIndex(current => tutorialPageAfter(current, action));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const complete = () => {
    completeMovementTutorial(deviceStorage());
    onClose();
  };

  return <DialogueFrame ariaLabel={source === 'menu' ? 'Movement tutorial from game menu' : 'Movement tutorial'} soundControl>
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-green-strong">{pageIndex + 1} / {tutorialPages.length}</p>
          <h2 className="text-[18px] font-extrabold [overflow-wrap:anywhere]">{page.title}</h2>
        </div>
        <GameButton label="Skip" onClick={complete} />
      </div>
      {pageIndex === 0 ? <p className="text-sm font-bold">Welcome, {playerName}.</p> : null}
      <p className="max-w-[60ch] text-[15px] leading-6 text-ink">{page.description}</p>
      <div className="mt-auto flex flex-wrap justify-end gap-2">
        {pageIndex > 0 ? <GameButton label="Back" onClick={() => setPageIndex(current => tutorialPageAfter(current, 'previous'))} /> : null}
        <GameButton label={tutorialPrimaryLabel(pageIndex)} onClick={finalPage
          ? complete
          : () => setPageIndex(current => tutorialPageAfter(current, 'next'))} />
      </div>
    </div>
  </DialogueFrame>;
}
