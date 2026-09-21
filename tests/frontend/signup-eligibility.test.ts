import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  normalizeInstitutionalEmail,
  normalizeReferralCode,
  validateInstitutionalEmail,
  validateReferralCode,
} from '../../frontend/src/auth/signupEligibilityValidation.ts';
import {
  createTestEmailAuthHandler,
  PROJECT_URL,
  type TestEmailAuthConfig,
} from '../../backend/supabase/functions/test-institutional-email-auth/handler.ts';

const config: TestEmailAuthConfig = {
  url: PROJECT_URL,
  anonKey: 'publishable-test',
  serviceKey: 'service-secret-never-return',
  enabled: 'true',
  expiresAt: '2030-01-01T00:00:00Z',
};
const request = (body: object, authorization = 'Bearer member-jwt') => new Request('http://localhost', {
  method: 'POST',
  headers: { authorization, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('referral and institutional email inputs normalize and reject unsafe forms', () => {
  assert.equal(normalizeReferralCode(' ymd-12ab34cd '), 'YMD-12AB34CD');
  assert.equal(validateReferralCode('ymd-12ab34cd'), null);
  assert.match(validateReferralCode('YMD-123')!, /유효한/);
  assert.equal(normalizeInstitutionalEmail(' Person@School.AC.KR '), 'person@school.ac.kr');
  assert.equal(validateInstitutionalEmail('person@school.ac.kr'), null);
  assert.match(validateInstitutionalEmail('person@gmail.com')!, /무료 이메일/);
});

test('test email endpoint requires its independent active window and a member bearer token', async () => {
  const disabled = createTestEmailAuthHandler({ ...config, enabled: 'false' }, async () => { throw new Error('unreachable'); });
  assert.equal((await disabled(request({ action: 'request', email: 'a@school.ac.kr' }))).status, 503);
  const active = createTestEmailAuthHandler(config, async () => { throw new Error('unreachable'); });
  assert.equal((await active(request({ action: 'request', email: 'a@school.ac.kr' }, ''))).status, 401);
});

test('request authenticates the user and calls only the server RPC without returning sensitive values', async () => {
  const calls: Array<{ url: string; authorization: string; body?: string }> = [];
  const handler = createTestEmailAuthHandler(config, async (input, init) => {
    const url = String(input);
    calls.push({ url, authorization: new Headers(init?.headers).get('authorization') || '', body: init?.body?.toString() });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: '11111111-1111-1111-1111-111111111111' });
    return Response.json([{ expires_at: '2029-01-01T00:10:00Z' }]);
  });
  const response = await handler(request({ action: 'request', email: ' Person@School.AC.KR ' }));
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /246810/);
  assert.doesNotMatch(text, /Person@|member-jwt|service-secret/);
  assert.equal(calls[0].authorization, 'Bearer member-jwt');
  assert.equal(calls[1].authorization, 'Bearer service-secret-never-return');
  assert.match(calls[1].body || '', /person@school\.ac\.kr/);
});

test('wrong and correct fixed codes are delegated as booleans and produce distinct responses', async () => {
  const validFlags: boolean[] = [];
  const handler = createTestEmailAuthHandler(config, async (input, init) => {
    if (String(input).endsWith('/auth/v1/user')) return Response.json({ id: '11111111-1111-1111-1111-111111111111' });
    const body = JSON.parse(String(init?.body));
    validFlags.push(body.p_code_valid);
    return Response.json([body.p_code_valid ? { verified: true, status: 'verified' } : { verified: false, status: 'invalid_email_code' }]);
  });
  assert.equal((await handler(request({ action: 'verify', email: 'a@school.ac.kr', code: '000000' }))).status, 400);
  assert.equal((await handler(request({ action: 'verify', email: 'a@school.ac.kr', code: '246810' }))).status, 200);
  assert.deepEqual(validFlags, [false, true]);
});

test('migration contract locks private data and removes direct profile insert', () => {
  const sql = readFileSync(new URL('../../backend/supabase/migrations/20260917043418_signup_eligibility_author_demographics.sql', import.meta.url), 'utf8');
  for (const table of ['signup_eligibility', 'female_referral_codes', 'referral_signup_audit', 'institutional_email_verifications']) {
    assert.match(sql, new RegExp(`alter table private\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table private\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /drop policy if exists "profiles_insert_own"/);
  assert.match(sql, /revoke insert \(id, real_name, birth_date, gender, avatar_url, bio\)/);
  assert.match(sql, /security definer\nset search_path = ''/);
  assert.match(sql, /grant execute on function public\.complete_signup[\s\S]*to authenticated/);
  assert.match(sql, /request_test_institutional_email_verification[\s\S]*to service_role/);
  assert.match(sql, /if exists \(select 1 from public\.profiles p where p\.id = v_uid\)[\s\S]*return query/, 'signup retry must be idempotent');
  assert.match(sql, /join public\.profiles p on p\.id = c\.owner_id and p\.gender = 'female'/, 'male owners must not qualify as referrers');
  assert.match(sql, /where c\.code = v_referral and c\.active/, 'unknown or inactive referrals must fail');
  assert.doesNotMatch(sql, /delete from private\.female_referral_codes/, 'referral codes must remain reusable');
  assert.match(sql, /on conflict \(owner_id\) do nothing/, 'concurrent lazy creation must converge on one owner row');
  assert.match(sql, /normalized_email = excluded\.normalized_email[\s\S]*verified_at = null/, 'changing email must invalidate verification');
  assert.match(sql, /interval '10 minutes'/);
  assert.match(sql, /gmail\.com[\s\S]*naver\.com[\s\S]*outlook\.com[\s\S]*icloud\.com/);
  assert.match(sql, /signup_eligibility_institutional_email_unique/);
});
