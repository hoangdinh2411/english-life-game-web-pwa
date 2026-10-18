import { portraitGridPosition } from '../../shared/portrait-grid';

export function npcPortraitPosition(text: string, thinking = false): string {
  const expression = thinking || /\b(sorry|cannot|can't|closed|problem|unfortunately|not sure)\b/i.test(text)
    ? 2
    : /!|\b(welcome|great|glad|thank|yes|sure|enjoy|love)\b/i.test(text) ? 1 : 0;
  return portraitGridPosition(expression, 3, 1);
}
