import type { RouteState } from '../types/navigation';

const routes = new Set(['/sign-in', '/new-game', '/new-game/country', '/new-game/avatar', '/new-game/name', '/new-game/review', '/home']);

// Public practice requires neither a token nor a cached player profile.
export function resolveRoute(path: string, { token, hasCharacter, online }: RouteState): string {
  if (!online && path === '/home' && token && hasCharacter) return '/home';
  if (path === '/practice' || (!online && path !== '/sign-in')) return '/practice';
  if (!online) return '/sign-in';
  if (!token) return '/sign-in';
  if (hasCharacter) return '/home';
  return routes.has(path) && path !== '/sign-in' && path !== '/home' ? path : '/new-game';
}
