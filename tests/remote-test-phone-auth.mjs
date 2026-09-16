// Explicit live integration check; creates two persistent test users/profiles.
import assert from 'node:assert/strict';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local', quiet: true });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url, 'https://bndguguarijmghnkenvt.supabase.co');
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function invoke(phone, code = '123456', action = 'verify') {
  const response = await fetch(`${url}/functions/v1/test-phone-auth`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, action }),
  });
  return { status: response.status, data: await response.json() };
}
async function login(phone) {
  const result = await invoke(phone);
  assert.equal(result.status, 200, result.data.message);
  const sdk = client();
  const { data, error } = await sdk.auth.setSession(result.data);
  assert.equal(error, null);
  assert.ok(data.user.id);
  return { sdk, user: data.user };
}
assert.equal((await invoke('01091619999', '000000')).status, 400);
assert.equal((await invoke('01091619999', '', 'request')).status, 200);
assert.equal((await invoke('0101234', '123456')).status, 400);
const a = await login('01091610001');
const b = await login('98791610002');
assert.notEqual(a.user.id, b.user.id);
for (const [index, member] of [a, b].entries()) {
  assert.equal(member.user.app_metadata.test_phone_auth, true);
  assert.equal(member.user.app_metadata.phone_ownership_verified, false);
  const existing = await member.sdk.from('profiles').select('id').eq('id', member.user.id).maybeSingle();
  assert.equal(existing.error, null);
  const fields = { nickname: `활성검증${index + 1}`, birth_date: '2000-09-16' };
  // Match the application: INSERT id once; never request UPDATE permission on id.
  const saved = existing.data
    ? await member.sdk.from('profiles').update(fields).eq('id', member.user.id).select()
    : await member.sdk.from('profiles').insert({ id: member.user.id, ...fields }).select();
  assert.equal(saved.error, null);
  assert.equal(saved.data[0].id, member.user.id);
}
const otherRead = await a.sdk.from('profiles').select('*').eq('id', b.user.id);
assert.equal(otherRead.error, null);
assert.deepEqual(otherRead.data, []);
const otherWrite = await a.sdk.from('profiles').update({ nickname: '접근금지' }).eq('id', b.user.id).select();
assert.equal(otherWrite.error, null);
assert.deepEqual(otherWrite.data, []);
const anonRead = await client().from('profiles').select('*');
assert.ok(anonRead.error || anonRead.data.length === 0);
const createdAtWrite = await a.sdk.from('profiles').update({ created_at: '2001-01-01T00:00:00Z' }).eq('id', a.user.id);
assert.ok(createdAtWrite.error);
assert.equal((await a.sdk.auth.signOut()).error, null);
const again = await login('01091610001');
assert.equal(again.user.id, a.user.id);
assert.equal((await again.sdk.from('profiles').select('nickname').single()).data.nickname, '활성검증1');
assert.equal((await again.sdk.auth.refreshSession()).error, null);
const legacyRequest = await invoke('01000000010', '', 'request');
assert.equal(legacyRequest.status, 200, legacyRequest.data.message);
const legacy = await login('01000000010');
assert.equal(legacy.user.phone, '821000000010');
for (const member of [b, again, legacy]) assert.equal((await member.sdk.auth.signOut()).error, null);
console.log(JSON.stringify({ result: 'PASS', cases: ['wrong OTP', 'request only', 'invalid length', 'new real users/session', 'non-010 number', 'test metadata', 'profile persistence', 'same UUID relogin', 'refresh session', 'A/B RLS read/write', 'anonymous RLS', 'timestamp write rejected', 'legacy OTP', 'logout'], userIds: [a.user.id, b.user.id] }));
