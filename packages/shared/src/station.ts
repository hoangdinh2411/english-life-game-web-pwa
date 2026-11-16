import script from './dialogue/content/station.json';
import intents from './dialogue/content/intents.station.json';
import { defineContextProfile } from './dialogue/intent-contract';
import { detectContextIntent } from './dialogue/intent-detector';
import { checkGrammar, detectIntent, normalizeDialogue, type IntentMatch } from './dialogue/language';
import { splitGreeting } from './dialogue/questions';

export type StationSpeaker = 'npc_station_information' | 'npc_passenger_backpack' | 'npc_passenger_suitcase' | 'npc_passenger_visitor';
export interface StationExchange { text: string; hint: string; step: number; directions: boolean; followUp?: 'directions' | 'conversation'; aiFallback?: true }
const HINT = 'Ask about an ID card, or say goodbye.';

export const STATION_QUESTION_PROFILE = defineContextProfile({
  id: 'station_question',
  allowedIntents: ['confirm', 'deny', 'cancel'],
});

export const STATION_OPEN_PROFILE = defineContextProfile({
  id: 'station_open',
  allowedIntents: ['deny', 'cancel'],
});

export function stationGreeting(npc: StationSpeaker): StationExchange {
  const key = npc === 'npc_station_information' ? 'receptionist' : npc === 'npc_passenger_backpack' ? 'backpack' : npc === 'npc_passenger_suitcase' ? 'suitcase' : 'visitor';
  return { text: key === 'suitcase' ? script.nodes.ask_journey.text : script.greetings[key], hint: npc === 'npc_station_information' ? 'Try: “Hello! I’m new here.”' : 'Tell me about yourself or your journey.', step: 0, directions: false };
}
// Temporary client practice only; this never grants rewards or durable quest state.
export function stationReply(npc: StationSpeaker, step: number, input: string, followUp?: StationExchange['followUp']): StationExchange {
  const answeringQuestion = followUp !== undefined || npc === 'npc_passenger_backpack';
  const { greeting: hasGreeting, body } = splitGreeting(normalizeDialogue(input));
  const decision = detectContextIntent(
    hasGreeting && body ? body : input,
    answeringQuestion ? STATION_QUESTION_PROFILE : STATION_OPEN_PROFILE,
  );
  const contextIntent = decision.status === 'matched' && decision.modifiers.length === 0 ? decision.primary : undefined;
  const intent: IntentMatch | undefined = contextIntent
    ? { id: contextIntent === 'cancel' ? 'deny' : contextIntent, slots: {} }
    : detectIntent(input, intents.intents);
  const receptionist = npc === 'npc_station_information';
  const base = { step, directions: receptionist && step >= 2, hint: HINT };
  const requestsDirections = intent?.id === 'request_document' || (intent?.id === 'ask_location' && intent.slots.place === 'tax_office');
  const journeyAnswer = npc === 'npc_passenger_suitcase' && /^(?:it was |the journey was |a (?:little|bit) )?(?:good|great|fine|long|tiring|okay|ok)(?:[,!.]? (?:thanks|thank you))?[.!]?$/i.test(input.trim());
  const supported = intent !== undefined && (intent.id !== 'ask_location' || requestsDirections);
  if (!supported && !journeyAnswer) return { ...base, text: script.nodes.ai_pending.text, aiFallback: true, ...(followUp && !intent ? { followUp } : {}) };
  if (receptionist && step === 0 && !hasGreeting) return { ...stationGreeting(npc), text: 'Let’s start with a greeting. You can say “Hello!”' };
  if (intent?.id === 'deny') return { ...base, text: script.nodes.deny.text };
  if (intent?.id === 'goodbye' || intent?.id === 'thank') return { ...base, text: script.nodes.goodbye.text };
  const feedback = checkGrammar(input);
  if (feedback) {
    return { ...base, step: receptionist && step === 0 ? 1 : step, text: script.nodes.confirmation.text.replace('{question}', feedback.question), followUp: requestsDirections ? 'directions' : 'conversation', hint: 'Reply naturally: confirm, explain more, or tell me what you meant.' };
  }
  if (requestsDirections || (intent?.id === 'confirm' && followUp === 'directions')) return receptionist ? { ...base, text: script.nodes.directions.text, step: 2, directions: true } : { ...base, text: script.nodes.passenger_directions.text };
  if (intent?.id === 'greet' && receptionist) return { ...base, text: script.nodes.request.text, step: Math.max(1, step) };
  if (intent?.id === 'confirm' || intent?.id === 'introduce' || intent?.id === 'describe_journey' || journeyAnswer || intent?.id === 'greet') return { ...base, text: receptionist ? script.nodes.request.text : script.nodes.passenger_chat.text };
  return { ...base, text: script.nodes.clarify.text, ...(followUp && !intent ? { followUp } : {}) };
}

