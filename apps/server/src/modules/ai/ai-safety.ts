const MAX_INPUT_CHARACTERS = 300;
const MAX_OUTPUT_WORDS = 40;

const promptInjection = /\b(?:ignore|override|forget|disregard)\b.{0,40}\b(?:rules?|instructions?|prompt|role)\b|\b(?:system prompt|developer message|jailbreak)\b/i;
const economyManipulation = /(?:[$£€¥]\s*\d|\b\d+\s*(?:dollars?|pounds?|euros?|coins?)\b)|\b(?:change|set|lower|raise|make|invent|fake|say|claim|give|grant|add)\b.{0,40}\b(?:price|cost|free|money|coins?|xp|items?|tickets?|rewards?|quests?)\b/i;
const medicalTopic = /\b(?:medicine|medication|dose|dosage|painkillers?|diagnos(?:e|is)|treatment|symptoms?|chest pain|prescription|doctor|medical advice|sick|illness)\b/i;
const privateData = /\b(?:my|player(?:'s)?|user(?:'s)?|learner(?:'s)?)\s+(?:real\s+)?(?:name|email|address|phone|user\s*id|account|password|location)\b|\b(?:show|tell|give|send|reveal)\b.{0,30}\b(?:email|address|phone|user\s*id|account|password|personal data)\b/i;
const privateDataRequest = /\b(?:what(?:'s| is)|where(?:'s| is)|tell|show|give|send|share|reveal|provide|enter)\b.{0,35}\b(?:your|player(?:'s)?|user(?:'s)?|learner(?:'s)?)\s+(?:real\s+)?(?:name|email|address|phone|user\s*id|account|password|location)\b/i;
const gameClaim = /(?:[$£€¥]\s*\d|\b\d+\s*(?:dollars?|pounds?|euros?|coins?)\b)|\b(?:price|costs?|items?|rewards?|quests?|tickets?|coins?|xp)\b/i;
const medicalAdvice = /\b(?:should|must|need to|take|use|try|avoid|recommend|prescribe|consult|see|dose|dosage|treat)\b.{0,50}\b(?:medicine|medication|aspirin|ibuprofen|painkillers?|doctor|symptoms?|pain|illness|dose|tablets?|pills?)\b|\b(?:take|use)\s+\d+\s+(?:mg|tablets?|pills?)\b/i;
const markdown = /```|`[^`]+`|\[[^\]]+\]\([^)]+\)|<\/?[a-z][^>]*>|(?:^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)|\*\*|__|~~/i;
const profanity = /\b(?:asshole|bastard|bitch|bullshit|cunt|damn|fuck(?:er|ing|ed)?|motherfucker|shit(?:ty)?)\b/i;

const foreignWords = new Set([
  'bonjour', 'merci', 'hola', 'gracias', 'como', 'estas', 'gusta', 'futbol',
  'hallo', 'danke', 'guten', 'morgen', 'ciao', 'grazie', 'buongiorno',
  'hej', 'tack', 'och', 'inte', 'jag', 'du', 'är', 'hur', 'mår',
]);

function words(text: string): string[] {
  return text.toLocaleLowerCase('en').normalize('NFD').replace(/\p{Mark}/gu, '')
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function isLikelyEnglish(text: string): boolean {
  const letters = [...text.matchAll(/\p{Letter}/gu)].map(match => match[0]);
  if (!letters.length || letters.some(letter => !/^\p{Script=Latin}$/u.test(letter))) return false;
  const tokens = words(text);
  const foreignCount = tokens.filter(token => foreignWords.has(token)).length;
  return foreignCount === 0 || foreignCount === 1 && tokens.length > 5;
}

function hasEmojiSpam(text: string): boolean {
  return (text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0) > 3;
}

export function safeAiInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_INPUT_CHARACTERS || hasEmojiSpam(trimmed) || !isLikelyEnglish(trimmed)) return null;
  if (promptInjection.test(trimmed) || economyManipulation.test(trimmed) || medicalTopic.test(trimmed) || privateData.test(trimmed)) return null;
  return trimmed;
}

export function isSafeAiOutput(output: string): boolean {
  const trimmed = output.trim();
  if (!trimmed || words(trimmed).length > MAX_OUTPUT_WORDS || hasEmojiSpam(trimmed) || !isLikelyEnglish(trimmed)) return false;
  return !markdown.test(trimmed) && !gameClaim.test(trimmed) && !privateDataRequest.test(trimmed)
    && !medicalAdvice.test(trimmed) && !profanity.test(trimmed);
}
