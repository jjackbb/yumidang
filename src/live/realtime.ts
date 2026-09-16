import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

type Listener = { table: string; event: 'INSERT' | 'UPDATE' | '*'; filter?: string; onChange: (row: any) => void };

/**
 * Subscribes to RLS-filtered postgres_changes; removed on unmount or when the key changes.
 * `onReady` runs once the database listener is live so callers can re-read anything sent during the join gap.
 */
export function useRealtime(key: string | null, listeners: Listener[], onReady?: () => void) {
  const latest = useRef(listeners);
  latest.current = listeners;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!key) return;
    const client = getSupabaseClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;
    void (async () => {
      const { data } = await client.auth.getSession();
      if (cancelled || !data.session) return;
      await client.realtime.setAuth(data.session.access_token);
      channel = client.channel(`live:${key}:${crypto.randomUUID()}`);
      latest.current.forEach((listener, index) => {
        channel!.on('postgres_changes' as any, { event: listener.event, schema: 'public', table: listener.table, ...(listener.filter ? { filter: listener.filter } : {}) },
          (payload: any) => latest.current[index]?.onChange(payload.new));
      });
      channel.on('system' as any, {}, (payload: any) => {
        if (payload?.extension === 'postgres_changes' && payload.status === 'ok' && !cancelled) { setReady(true); readyRef.current?.(); }
      });
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [key]);
  return ready;
}

/** Calls `fn` now and every `ms` while `enabled`; also on window focus. */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => latest.current(), ms);
    const onFocus = () => latest.current();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [ms, enabled]);
}
