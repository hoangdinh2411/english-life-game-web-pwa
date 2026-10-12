import { useEffect } from 'react';
import type { CoffeeQuestState } from '@life-abroad/shared';

export function shouldShowCoffeeQuestToast(previous: CoffeeQuestState | undefined, current: CoffeeQuestState | undefined): current is CoffeeQuestState {
  return previous?.status !== 'done' && current?.status === 'done' && current.rewardsGranted;
}

export function CoffeeQuestToast({ quest, onDismiss }: { quest: CoffeeQuestState; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return <aside role="status" aria-live="polite" aria-label={`${quest.title} complete`}
    className="fixed left-1/2 top-[max(16px,_env(safe-area-inset-top))] z-[100] w-[min(360px,_calc(100%_-_24px))] -translate-x-1/2 rounded-xl border-2 border-[#aa8b57] bg-[#fff7e8] p-3 text-center text-sm text-[#384d3c] shadow-lg">
    <strong>{quest.title}</strong>
    <p className="m-0 mt-1">Quest complete · Reward: {quest.rewards.xp} XP and ${quest.rewards.coins}.</p>
  </aside>;
}
