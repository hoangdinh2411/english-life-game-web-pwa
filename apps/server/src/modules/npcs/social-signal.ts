export type SocialSignal = 'greeting' | 'thanks' | 'polite_request' | 'apology' | 'insult';

function normalized(text: string): string {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function classifySocialSignal(text: string, intent: string | null): SocialSignal | null {
  const value = normalized(text);
  if (/^(?:sorry|i am sorry|i'm sorry|please forgive me|my apologies)(?:\b|$)/.test(value) || intent === 'apology') return 'apology';
  if (/\b(?:fuck you|shut up)\b/.test(value) || /\byou(?:'re| are) (?:an? )?(?:idiot|moron|stupid|useless|pathetic|ugly)\b/.test(value)) return 'insult';
  if (intent === 'thank' || /^(?:thanks|thank you|many thanks)(?:\b|$)/.test(value)) return 'thanks';
  if (intent === 'greet' || /^(?:hello|hi|hey|good morning|good afternoon|good evening)(?:\b|$)/.test(value)) return 'greeting';
  if ((/\bplease\b/.test(value) || /^(?:could|would|can) you\b/.test(value)) && intent !== null) return 'polite_request';
  return null;
}

