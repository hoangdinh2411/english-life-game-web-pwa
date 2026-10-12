import type { CoffeeQuestState } from '@life-abroad/shared';

export function CoffeeQuest({ quest }: { quest: CoffeeQuestState }) {
  return <aside aria-label="Your First Coffee quest" className="rounded-xl bg-[#e5eddf] p-2.5 text-sm leading-relaxed" aria-live="polite">
    <strong>{quest.title}</strong>
    {!quest.available ? <p>First complete Welcome to Maplewood by taking the bus ticket to Town Street. You can still chat and order here.</p>
      : quest.status === 'done' ? <p>Quest complete! {quest.rewardsGranted ? `Reward received once: ${quest.rewards.xp} XP and $${quest.rewards.coins}.` : 'Your saved progress is complete.'}</p>
        : <><p>{quest.objective}. {quest.currentStepId === 'coffee_greet' ? 'Say hello to Mia, the cashier.' : quest.currentStepId === 'coffee_order' ? 'Ask Mia for the menu, then name a drink.' : 'Confirm your pending drink order with Mia to pay.'}</p>
          <p>Reward: {quest.rewards.xp} XP and ${quest.rewards.coins}.</p></>}
  </aside>;
}
