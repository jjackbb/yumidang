export type AppTab = 'home' | 'explore' | 'chat' | 'me';
export const TAB_PATHS: Record<AppTab, string> = { home: '/', explore: '/explore', chat: '/chat', me: '/me' };
export const isProtectedPath = (path: string) => path === '/chat' || path === '/me';
export const tabForPath = (path: string): AppTab =>
  (Object.keys(TAB_PATHS) as AppTab[]).find(tab => TAB_PATHS[tab] === path) || 'home';

/** A strict allowlist prevents login links from redirecting to another site or demo mode. */
export function safeReturnPath(value: string | null | undefined) {
  return value && Object.values(TAB_PATHS).includes(value) ? value : '/me';
}

export function loginPath(next: string) {
  return `/login?next=${encodeURIComponent(safeReturnPath(next))}`;
}
