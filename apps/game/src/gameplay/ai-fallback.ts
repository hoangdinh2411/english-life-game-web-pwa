import type { AiFallbackContext, AiFallbackLogger } from '../types/gameplay/dialogue';

// Placeholder only. Private message text is deliberately absent from this log.
// A future implementation must call the backend, never an AI provider directly.
export function notifyAiFallback(context: AiFallbackContext, log: AiFallbackLogger = console.info): void {
  log('[dialogue] AI fallback requested (not connected)', {
    npcId: context.npcId,
    step: context.step,
    reason: 'no_script_match',
  });
}
