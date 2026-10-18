// Development-only visual fixture. Uses fictional data and makes no API calls.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { SavedConversation } from '../src/features/dialogue/SavedConversation';
import type { ConversationSnapshot } from '../src/features/dialogue/conversation-controller';
import portrait from '../assets/npcs/npc_lina_librarian/portraits.png';
import '../src/styles.css';

const arrival = { questId: 'q_station_arrival', status: 'active' as const, currentStepId: null,
  ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_town_street' as const, rewardsGranted: false };
const saved: ConversationSnapshot = { arrival, pending: false, streaming: false, streamedReply: '', error: '', correction: null,
  retryMessage: null, announcement: 'Reply complete.', conversation: { id: crypto.randomUUID(), npcId: 'npc_lina_librarian', arrival,
    messages: [{ id: crypto.randomUUID(), sender: 'player', text: 'What books do you enjoy?', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), sender: 'npc', text: 'I enjoy gentle mysteries and travel stories.', createdAt: new Date().toISOString(), ai: true }] } };

function Fixture() {
  const [view, setView] = useState<'stream' | 'limit' | 'offline' | 'saved'>('stream');
  const state: ConversationSnapshot = view === 'stream' ? { ...saved, pending: true, streaming: true, streamedReply: 'I enjoy gentle ', announcement: '' }
    : view === 'limit' ? { ...saved, error: 'Free chat is available again tomorrow. Try a prepared conversation for now.' } : saved;
  return <main className="min-h-dvh bg-paper p-2"><nav aria-label="Preview states" className="mb-2 flex flex-wrap gap-2">
    {(['stream','limit','offline','saved'] as const).map(item => <button className="game-button" key={item} onClick={() => setView(item)}>{item}</button>)}
  </nav><section className="mx-auto max-w-[720px] rounded-[18px] border-2 border-[#aa8b57] bg-dialogue p-3">
    <h1 className="text-[18px] font-extrabold">Fictional conversation preview</h1>
    <SavedConversation state={state} sound={false} online={view !== 'offline'} send={async () => false} retry={() => {}}
      displayNpc={{ name: 'Lina', portrait, portraitPosition: () => '0% 0%', portraitGrid: { columns: 3, rows: 1 } }} />
  </section></main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Fixture root is missing.');
createRoot(root).render(<Fixture />);
