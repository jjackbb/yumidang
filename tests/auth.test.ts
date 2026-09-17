import test from 'node:test';
import assert from 'node:assert/strict';
import type { User } from '@supabase/supabase-js';

import { currentUserFromProfile } from '../src/auth/user.ts';
import {
  authErrorMessage,
  exactAgeLabel,
  toE164KoreanPhone,
  validateRealName,
  validateSignupProfile,
  type SignupProfile,
} from '../src/auth/signup.ts';
import {
  SupabaseConfigError,
  validateSupabaseConfig,
  YUMIDANG_SUPABASE_URL,
} from '../src/lib/supabase.ts';

const NOW = new Date('2026-09-16T03:00:00Z');

test('Korean phone is validated and converted to E.164 before Supabase OTP', () => {
  assert.equal(toE164KoreanPhone('01000000002'), '+821000000002');
  assert.throws(() => toE164KoreanPhone('0101234'), /11자리/);
});

test('signup profile validation trims the real name and enforces adult birth date', () => {
  assert.equal(validateRealName(' 변종현 '), null);
  assert.match(validateRealName('변') || '', /2~20자/);
  assert.equal(validateSignupProfile('유미', '2000-09-16', NOW), null);
  assert.match(validateSignupProfile('유미', '2010-01-01', NOW) || '', /만 19세/);
  assert.match(validateSignupProfile('변종현', '2000-09-16', NOW, null) || '', /성별/);
  assert.equal(validateSignupProfile('변종현', '2000-09-16', NOW, 'male'), null);
});

test('exact age label uses the Seoul calendar date instead of an age band', () => {
  assert.equal(exactAgeLabel('2001-09-16', NOW), '25살');
  assert.equal(exactAgeLabel('2001-09-17', NOW), '24살');
});

test('Supabase config accepts only the designated project and a publishable key', () => {
  assert.deepEqual(validateSupabaseConfig(YUMIDANG_SUPABASE_URL, 'sb_publishable_test'), {
    url: YUMIDANG_SUPABASE_URL,
    publishableKey: 'sb_publishable_test',
  });
  assert.throws(
    () => validateSupabaseConfig('https://fiaxchvyywpqbwbcuzfz.supabase.co', 'sb_publishable_test'),
    SupabaseConfigError,
  );
  assert.throws(() => validateSupabaseConfig(YUMIDANG_SUPABASE_URL, 'service_role_secret'), /publishable key/);
});

test('OTP errors distinguish rate limiting, expiry, and invalid codes', () => {
  assert.match(authErrorMessage({ message: 'rate limit', status: 429 }, 'send'), /잠시/);
  assert.match(authErrorMessage({ message: 'otp_expired' }, 'verify'), /만료/);
  assert.match(authErrorMessage({ message: 'invalid token' }, 'verify'), /맞지 않아요/);
  assert.match(authErrorMessage({ message: 'Signups not allowed for otp', status: 422, code: 'otp_disabled' }, 'send', 'login'), /가입된 휴대폰 번호가 아니에요/);
  assert.match(authErrorMessage({ message: 'Failed to fetch' }, 'send'), /개발 서버를 다시 시작/);
});

test('Supabase profile becomes the minimum current user with an exact age', () => {
  const profile: SignupProfile = {
    id: '75ab41dd-dfb4-4fbd-b273-573c9f27f518',
    real_name: '변종현',
    gender: 'female',
    birth_date: '2001-09-16',
    avatar_url: null,
    bio: null,
    created_at: '2026-09-16T07:34:51.223Z',
    updated_at: '2026-09-16T07:34:51.223Z',
  };
  const user = {
    id: profile.id,
    phone: '821000000002',
    phone_confirmed_at: '2026-09-16T07:34:51.223Z',
  } as User;
  const mapped = currentUserFromProfile(user, profile, NOW);
  assert.equal(mapped.ageGroup, '25살');
  assert.equal(mapped.maskedName, '변*현');
  assert.equal(mapped.isPhoneVerified, true);
  assert.equal(mapped.realName, '변종현');
  assert.equal(mapped.gender, 'female');
});

test('real-name masking matches the server rule', async () => {
  const { maskRealName } = await import('../src/utils/maskName.ts');
  assert.equal(maskRealName('변종'), '변*');
  assert.equal(maskRealName('변종현'), '변*현');
  assert.equal(maskRealName('변종현미'), '변**미');
  assert.equal(maskRealName(' 김 '), '*');
});

test('login return path accepts only internal tab paths', async () => {
  const { safeReturnPath, loginPath } = await import('../src/auth/routes.ts');
  assert.equal(safeReturnPath('/chat'), '/chat');
  assert.equal(safeReturnPath('/me'), '/me');
  for (const value of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/me?demo=1', '/unknown', '', null])
    assert.equal(safeReturnPath(value), '/');
  assert.equal(loginPath('/chat'), '/login?next=%2Fchat');
});
