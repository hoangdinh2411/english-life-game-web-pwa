import { normalizeDialogue } from '@life-abroad/shared';

// These are grammatical glue, not a list of game topics. Topic vocabulary itself
// is derived exclusively from authored keywords and catalog item names.
const glue = new Set('a an the i me my we our you your he she it they to for of in on at with and or is are am be do does can could would will how what when where who why have has please want like need get some any very really'.split(' '));
const words = (text: string): string[] => normalizeDialogue(text).toLowerCase().replace(/[^a-z0-9']/g, ' ').split(/\s+/).filter(Boolean);

function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function hasScriptTopic(input: string, keywords: string[], itemNames: string[]): boolean {
  const tokens = words(input);
  const text = tokens.join(' ');
  if (keywords.some(keyword => words(keyword).join(' ') === text)) return true;
  const vocabulary = new Set([...keywords, ...itemNames].flatMap(words).filter(word => word.length >= 3 && !glue.has(word)));
  return tokens.filter(token => !glue.has(token)).some(token => [...vocabulary].some(topic => near(token, topic)));
}
