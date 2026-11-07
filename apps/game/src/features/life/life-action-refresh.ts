import type { LifeAction } from './life-api';

export function shouldRefreshAfterLifeAction(action: LifeAction): boolean {
  return action.path !== 'sleep';
}
