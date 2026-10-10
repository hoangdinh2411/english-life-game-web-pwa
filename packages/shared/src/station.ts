import script from './dialogue/content/station.json';
import intents from './dialogue/content/intents.station.json';
import { checkGrammar, detectIntent } from './dialogue/language';
import { splitGreeting } from './dialogue/questions';

export type StationSpeaker = 'npc_station_information' | 'npc_passenger_backpack' | 'npc_passenger_suitcase';
export interface StationExchange { text: string; hint: string; step: number; directions: boolean; correction?: { original: string; improved: string; reason: string }; followUp?: 'directions' | 'conversation'; aiFallback?: true }
const HINT = 'Ask about an ID card, or say goodbye.';
export function stationGreeting(npc: StationSpeaker): StationExchange {
  const key = npc === 'npc_station_information' ? 'receptionist' : npc === 'npc_passenger_backpack' ? 'backpack' : 'suitcase';
  return { text: key === 'suitcase' ? script.nodes.ask_journey.text : script.greetings[key], hint: npc === 'npc_station_information' ? 'Try: “Hello! I’m new here.”' : 'Tell me about yourself or your journey.', step: 0, directions: false };
}
// Temporary client practice only; this never grants rewards or durable quest state.
export function stationReply(npc: StationSpeaker, step: number, input: string, followUp?: StationExchange['followUp']): StationExchange {
  const answeringQuestion = followUp !== undefined || npc === 'npc_passenger_backpack';
  const intent = detectIntent(input, answeringQuestion, intents.intents);
  const receptionist = npc === 'npc_station_information';
  const hasGreeting = splitGreeting(input).greeting;
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
    const { original, improved, reason, question } = feedback;
    return { ...base, step: receptionist && step === 0 ? 1 : step, text: script.nodes.confirmation.text.replace('{question}', question), correction: { original, improved, reason }, followUp: requestsDirections ? 'directions' : 'conversation', hint: 'Reply naturally: confirm, explain more, or tell me what you meant.' };
  }
  if (requestsDirections || (intent?.id === 'confirm' && followUp === 'directions')) return receptionist ? { ...base, text: script.nodes.directions.text, step: 2, directions: true } : { ...base, text: script.nodes.passenger_directions.text };
  if (intent?.id === 'greet' && receptionist) return { ...base, text: script.nodes.request.text, step: Math.max(1, step) };
  if (intent?.id === 'confirm' || intent?.id === 'introduce' || intent?.id === 'describe_journey' || journeyAnswer || intent?.id === 'greet') return { ...base, text: receptionist ? script.nodes.request.text : script.nodes.passenger_chat.text };
  return { ...base, text: script.nodes.clarify.text, ...(followUp && !intent ? { followUp } : {}) };
}

