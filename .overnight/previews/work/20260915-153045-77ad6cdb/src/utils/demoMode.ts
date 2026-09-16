// The review tools use `?demo=1`; ordinary visits use the configured auth mode.
export const isDemoSearch = (search: string) => new URLSearchParams(search).get('demo') === '1';

export const isDemoMode = () =>
  typeof window !== 'undefined' && isDemoSearch(window.location.search);

/** Prototype authentication is explicit and never supplies a Supabase session. */
export const usesPrototypeAuth = () => isDemoMode() || import.meta.env?.VITE_AUTH_MODE === 'prototype';

/** Supabase auth, DB writes and analytics stay off in both prototype modes. */
export const externalServicesBlocked = () => usesPrototypeAuth();

export const demoNow = (offsetMs: number, realMs = Date.now()) =>
  new Date(realMs + (Number.isFinite(offsetMs) ? offsetMs : 0));

/** Offset that makes the demo clock read `targetIso`; null for an invalid date. */
export function offsetFor(targetIso: string, realMs = Date.now()) {
  const target = Date.parse(targetIso);
  return Number.isFinite(target) ? target - realMs : null;
}

/** `YYYY-MM-DDTHH:mm` in Asia/Seoul for datetime-local inputs. */
export function koreaInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function fromKoreaInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}:00+09:00`);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
