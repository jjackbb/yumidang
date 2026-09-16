import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { observeAuth, type AuthState } from '../src/auth/session.ts';
import { currentUserFromAuth } from '../src/auth/user.ts';
import { isProtectedPath, loginPath, safeReturnPath, tabForPath } from '../src/auth/routes.ts';
import { normalizeKoreanMobile } from '../src/auth/phone.ts';

const user = { id: 'real-auth-user', email: 'member@example.test', created_at: '2026-09-15T00:00:00Z', user_metadata: {}, app_metadata: {} } as User;
const session = { access_token: 'test-token', user } as Session;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };

function harness(getSession: () => Promise<unknown>, getUser: () => Promise<unknown>) {
  let callback: (event: string, session: Session | null) => void;
  let unsubscribed = false;
  const states: AuthState[] = [];
  const auth = {
    getSession, getUser,
    onAuthStateChange: (fn: typeof callback) => {
      callback = fn;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
  } as unknown as SupabaseClient['auth'];
  const stop = observeAuth(auth, state => states.push(state));
  return { states, stop, event: (value: Session | null) => callback('SIGNED_IN', value), unsubscribed: () => unsubscribed };
}

test('public routes and protected destinations have stable URLs', () => {
  assert.equal(isProtectedPath('/chat'), true);
  assert.equal(isProtectedPath('/me'), true);
  assert.equal(isProtectedPath('/'), false);
  assert.equal(isProtectedPath('/explore'), false);
  assert.equal(tabForPath('/chat'), 'chat');
  assert.equal(loginPath('/chat'), '/login?next=%2Fchat');
});

test('return destinations cannot switch origin, enter demo mode or loop to login', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/chat?demo=1', '/me#access_token=fake', '%2f%2fevil.test', null]) {
    assert.equal(safeReturnPath(value), '/me', String(value));
  }
  assert.equal(safeReturnPath('/explore'), '/explore');
});

test('restored user data is hidden until Auth validates the access token', async () => {
  const response = deferred<{ data: { user: User }; error: null }>();
  const h = harness(async () => ({ data: { session }, error: null }), () => response.promise);
  try {
    await flush();
    assert.equal(h.states.at(-1)?.status, 'loading');
    assert.equal(h.states.at(-1)?.user, null);
    response.resolve({ data: { user }, error: null });
    await flush();
    assert.equal(h.states.at(-1)?.user?.id, user.id);
  } finally { h.stop(); }
});

test('sign out wins over a slow initial session restore', async () => {
  const initial = deferred<unknown>();
  const h = harness(() => initial.promise, async () => ({ data: { user }, error: null }));
  try {
    h.event(null);
    initial.resolve({ data: { session }, error: null });
    await flush();
    assert.equal(h.states.at(-1)?.status, 'anonymous');
  } finally { h.stop(); }
});

test('sign out wins over an in-flight user validation', async () => {
  const validation = deferred<unknown>();
  const h = harness(async () => ({ data: { session }, error: null }), () => validation.promise);
  try {
    await flush(); h.event(null);
    validation.resolve({ data: { user }, error: null });
    await flush();
    assert.equal(h.states.at(-1)?.status, 'anonymous');
  } finally { h.stop(); }
});

test('changing accounts cannot be overwritten by the previous account response', async () => {
  const first = deferred<unknown>(); const second = deferred<unknown>(); let calls = 0;
  const h = harness(async () => ({ data: { session }, error: null }), () => (++calls === 1 ? first.promise : second.promise));
  try {
    await flush(); h.event({ ...session, access_token: 'second' }); await flush();
    second.resolve({ data: { user: { ...user, id: 'second' } }, error: null }); await flush();
    first.resolve({ data: { user }, error: null }); await flush();
    assert.equal(h.states.at(-1)?.user?.id, 'second');
  } finally { h.stop(); }
});

test('invalid tokens and anonymous Supabase accounts cannot open private areas', async () => {
  for (const response of [
    { data: { user: null }, error: { status: 401 } },
    { data: { user: { ...user, is_anonymous: true } }, error: null },
  ]) {
    const h = harness(async () => ({ data: { session }, error: null }), async () => response);
    try { await flush(); assert.equal(h.states.at(-1)?.status, 'anonymous'); }
    finally { h.stop(); }
  }
});

test('network failure offers retry without exposing private content', async () => {
  const h = harness(async () => ({ data: { session }, error: null }), async () => { throw new Error('offline'); });
  try { await flush(); assert.equal(h.states.at(-1)?.status, 'error'); assert.equal(h.states.at(-1)?.user, null); }
  finally { h.stop(); }
});

test('unmount unsubscribes and ignores late responses', async () => {
  const initial = deferred<unknown>();
  const h = harness(() => initial.promise, async () => ({ data: { user }, error: null }));
  h.stop(); const count = h.states.length;
  initial.resolve({ data: { session }, error: null }); await flush();
  assert.equal(h.states.length, count); assert.equal(h.unsubscribed(), true);
});

test('profile metadata cannot grant badges, pro access, sample identity or sugar', () => {
  const result = currentUserFromAuth({ ...user, user_metadata: { id: 'sample', isPhoneVerified: true, isKycVerified: true, isProHost: true, sugarContent: 99, gender: 'invalid' } });
  assert.equal(result.id, user.id); assert.equal(result.isSample, false);
  assert.equal(result.isPhoneVerified, false); assert.equal(result.isKycVerified, false);
  assert.equal(result.isProHost, undefined); assert.equal(result.sugarContent, 15);
  assert.equal(result.gender, 'undisclosed'); assert.equal(result.phone, '');
  assert.equal(result.neighborhood, ''); assert.equal(result.avatar, '');
});

test('phone normalization preserves valid numbers and rejects malformed input', () => {
  for (const value of ['01012345678', '010-1234-5678', '+82 10 1234 5678', '821012345678']) {
    assert.equal(normalizeKoreanMobile(value), '+821012345678');
  }
  for (const value of ['', '0101234567', '010123456789', 'abc01012345678', '+821012345678999', '+12025550123']) {
    assert.equal(normalizeKoreanMobile(value), null, value);
  }
});
