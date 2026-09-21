import { useCallback, useSyncExternalStore } from 'react';
import { TAB_PATHS, tabForPath, type AppTab } from './routes';

const routeEvent = 'yumidang:navigate';
const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  window.addEventListener(routeEvent, callback);
  return () => { window.removeEventListener('popstate', callback); window.removeEventListener(routeEvent, callback); };
};
const snapshot = () => window.location.pathname + window.location.search;

export function useAppRoute() {
  const location = useSyncExternalStore(subscribe, snapshot);
  const path = location.split('?')[0].replace(/\/$/, '') || '/';
  const navigate = useCallback((target: string, replace = false) => {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (new URLSearchParams(window.location.search).get('demo') === '1') url.searchParams.set('demo', '1');
    const next = url.pathname + url.search;
    if (snapshot() === next) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    window.dispatchEvent(new Event(routeEvent));
  }, []);
  const setActiveTab = useCallback((tab: AppTab) => navigate(TAB_PATHS[tab]), [navigate]);
  return { path, search: new URLSearchParams(location.split('?')[1]), activeTab: tabForPath(path), setActiveTab, navigate };
}
