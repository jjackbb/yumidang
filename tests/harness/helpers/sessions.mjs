// Real Supabase sessions obtained with the publishable key only (test-phone-auth + fixed test code).
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';

export const TEST_CODE = '123456';

// Persistent harness accounts. Names/birth dates are test data, not verified real names.
export const PERSONAS = {
  A: { phone: '01092700001', realName: '하네스에이', birthDate: '2001-01-15' },
  B: { phone: '01092700002', realName: '하네스비', birthDate: '1998-12-31' },
  C: { phone: '01092700003', realName: '하네스씨', birthDate: '2000-06-01' },
};

export function anonClient() {
  const { url, key } = loadEnv();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function testAuth(action, phone, { code = TEST_CODE, mode } = {}) {
  const { url, key } = loadEnv();
  const response = await fetch(`${url}/functions/v1/test-phone-auth`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, phone, code, ...(mode ? { mode } : {}) }),
  });
  const data = await response.json().catch(() => ({}));
  // Tokens stay inside this object; callers must never print it.
  return { status: response.status, data };
}

export async function signIn(phone, mode = 'signup') {
  const result = await testAuth('verify', phone, { mode });
  if (result.status !== 200) throw new Error(`test-phone-auth ${mode} failed with HTTP ${result.status}: ${result.data.message || ''}`);
  const sdk = anonClient();
  const { data, error } = await sdk.auth.setSession(result.data);
  if (error) throw error;
  return { sdk, userId: data.user.id, phone };
}

/** Logs in a persona and makes sure its basic profile exists (owner INSERT, like the app). */
export async function persona(name) {
  const spec = PERSONAS[name];
  const member = await signIn(spec.phone, 'signup');
  const existing = await member.sdk.from('profiles').select('id').eq('id', member.userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) {
    const inserted = await member.sdk.from('profiles').insert({ id: member.userId, real_name: spec.realName, birth_date: spec.birthDate });
    if (inserted.error) throw inserted.error;
  }
  return { ...member, name, ...spec };
}

export const rpc = async (member, fn, args = {}) => (member?.sdk || member).rpc(fn, args);
