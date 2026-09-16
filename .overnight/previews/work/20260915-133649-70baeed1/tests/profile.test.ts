import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIO_MAX_CHARS, PHOTO_MAX_BYTES, PLACEHOLDER_AVATAR, ageGroupOf, ageOn, avatarSrc, isProfileComplete, missingProfileSteps,
  sanitizePhone, validateBio, validateBirthDate, validateKoreanName, validatePhone, validatePhotoFile, validateReferralCode, validateWorkEmail,
} from '../src/utils/profile.ts';
import { OVERSIZED_IMAGE, defaultDemoSettings, savePrototype, loadPrototype, type PrototypeData } from '../src/utils/prototypeStore.ts';
import { publicProfileForMember, publicProfileForPost } from '../src/data/publicProfiles.ts';
import { demoAccounts } from '../src/data/demoAccounts.ts';
import type { CurrentUser, MeetupPost } from '../src/types.ts';

// 2026-09-15 12:00 KST
const NOW = new Date('2026-09-15T03:00:00Z');

test('phone keeps digits only and at most 11, for typing and pasting alike', () => {
  assert.equal(sanitizePhone('010-1234-56789'), '01012345678');
  assert.equal(sanitizePhone(' 010 1234 5678 '), '01012345678');
  assert.equal(sanitizePhone('0101234567890'), '01012345678');
  assert.equal(sanitizePhone('abc'), '');
  assert.equal(validatePhone('01012345678'), null);
  for (const bad of ['', '0101234567', '02012345678', '11012345678']) assert.ok(validatePhone(bad), bad);
});

test('real name must be complete Hangul syllables, 2-10 characters', () => {
  for (const ok of ['조유미', '남궁민수', '이서']) assert.equal(validateKoreanName(ok), null, ok);
  assert.match(validateKoreanName('')!, /입력/);
  assert.match(validateKoreanName('조ㅇ미')!, /낱자/);
  assert.match(validateKoreanName('ㅈㅗ')!, /낱자/);
  assert.match(validateKoreanName('Yumi')!, /한글로만/);
  assert.match(validateKoreanName('조 유미')!, /한글로만/);
  assert.match(validateKoreanName('조유미1')!, /한글로만/);
  assert.match(validateKoreanName('조')!, /2~10/);
  assert.match(validateKoreanName('가나다라마바사아자차카')!, /2~10/);
});

test('birth date: real calendar date, not in the future (KST), at least 19', () => {
  assert.equal(validateBirthDate('1998-04-12', NOW), null);
  assert.match(validateBirthDate('', NOW)!, /입력/);
  assert.match(validateBirthDate('2001-02-30', NOW)!, /올바른/);
  assert.match(validateBirthDate('1899-12-31', NOW)!, /올바른/);
  assert.match(validateBirthDate('2026-09-16', NOW)!, /미래/);
  // Exactly the 19th birthday on the Korean date counts; one day short does not.
  assert.equal(validateBirthDate('2007-09-15', NOW), null);
  assert.match(validateBirthDate('2007-09-16', NOW)!, /19세/);
  // 2026-09-15T15:30Z is already 09-16 in Seoul.
  assert.equal(ageOn('2007-09-16', new Date('2026-09-15T15:30:00Z')), 19);
  assert.equal(ageGroupOf('1998-04-12', NOW), '20대');
  assert.equal(ageGroupOf('1990-01-01', NOW), '30대');
  assert.equal(ageGroupOf('1970-01-01', NOW), '50대 이상');
  assert.equal(ageGroupOf(undefined, NOW), '');
});

test('male signup routes validate format only', () => {
  assert.equal(validateReferralCode('SAFE-7788'), null);
  assert.ok(validateReferralCode(''));
  assert.ok(validateReferralCode('ab'));
  assert.equal(validateWorkEmail('kim@company.co.kr'), null);
  assert.equal(validateWorkEmail('lee@snu.ac.kr'), null);
  assert.match(validateWorkEmail('me@gmail.com')!, /학교·직장/);
  assert.match(validateWorkEmail('me@naver.com')!, /학교·직장/);
  assert.ok(validateWorkEmail('not-an-email'));
});

test('photos: JPG/JPEG/PNG only, 10MB inclusive limit', () => {
  assert.equal(validatePhotoFile({ name: 'me.jpg', type: 'image/jpeg', size: 1000 }), null);
  assert.equal(validatePhotoFile({ name: 'me.JPEG', type: 'image/jpeg', size: 1000 }), null);
  assert.equal(validatePhotoFile({ name: 'me.png', type: 'image/png', size: PHOTO_MAX_BYTES }), null);
  assert.match(validatePhotoFile({ name: 'me.png', type: 'image/png', size: PHOTO_MAX_BYTES + 1 })!, /10MB/);
  assert.match(validatePhotoFile({ name: 'me.gif', type: 'image/gif', size: 1000 })!, /JPG/);
  assert.match(validatePhotoFile({ name: 'me.webp', type: 'image/webp', size: 1000 })!, /JPG/);
  assert.match(validatePhotoFile({ name: 'me.png.exe', type: 'application/octet-stream', size: 1000 })!, /JPG/);
  assert.match(validatePhotoFile({ name: 'fake.jpg', type: 'text/plain', size: 1000 })!, /JPG/);
});

test('bio: required, 300 chars inclusive, contacts and banned words rejected', () => {
  assert.equal(validateBio('전시를 천천히 보는 걸 좋아해요.'), null);
  assert.equal(validateBio('가'.repeat(BIO_MAX_CHARS)), null);
  assert.match(validateBio('가'.repeat(BIO_MAX_CHARS + 1))!, /300자/);
  assert.match(validateBio('   ')!, /입력/);
  for (const contact of ['연락은 010-1234-5678', '메일 me@test.com 주세요', '카톡 아이디 알려드려요', 'open.kakao.com/o/abc']) assert.match(validateBio(contact)!, /연락처/, contact);
  assert.match(validateBio('조건만남 환영')!, /사용할 수 없는/);
});

const newUser = (patch: Partial<CurrentUser> = {}): CurrentUser => ({
  id: 'user-new', isLoggedIn: true, phone: '01099998888', realName: '홍길동', maskedName: '홍*동', nickname: '홍*동', gender: 'male',
  birthDate: '1998-04-12', ageGroup: '20대', neighborhood: '마포구 연남동', sugarContent: 15, isPhoneVerified: false, isKycVerified: false,
  avatar: '', bio: '', hobbies: [], traits: [], joinedAt: '방금', referralCode: 'SAFE-7788', joinRoute: 'referral', ...patch,
});

test('profile completeness walks photo → interests → bio and treats a stripped photo as missing', () => {
  assert.deepEqual(missingProfileSteps(newUser()), ['photo', 'interests', 'bio']);
  assert.deepEqual(missingProfileSteps(newUser({ avatar: 'data:image/jpeg;base64,x' })), ['interests', 'bio']);
  assert.deepEqual(missingProfileSteps(newUser({ avatar: 'x.jpg', hobbies: ['전시'], traits: [] })), ['interests', 'bio']);
  assert.deepEqual(missingProfileSteps(newUser({ avatar: 'x.jpg', hobbies: ['전시'], traits: ['차분한'] })), ['bio']);
  assert.equal(isProfileComplete(newUser({ avatar: 'x.jpg', hobbies: ['전시'], traits: ['차분한'], bio: '반가워요' })), true);
  assert.deepEqual(missingProfileSteps(newUser({ avatar: OVERSIZED_IMAGE, hobbies: ['전시'], traits: ['차분한'], bio: '반가워요' })), ['photo']);
  assert.equal(avatarSrc(''), PLACEHOLDER_AVATAR);
  assert.equal(avatarSrc(OVERSIZED_IMAGE), PLACEHOLDER_AVATAR);
  for (const account of demoAccounts()) assert.equal(isProfileComplete(account), true, account.id);
});

test('saved profile shows the same public data everywhere, with age band only and no private fields', () => {
  const saved = newUser({ avatar: 'data:image/jpeg;base64,small', hobbies: ['전시', '사진'], traits: ['차분한'], bio: '천천히 둘러봐요', email: 'hong@company.co.kr' });
  const viewer = demoAccounts()[1];
  const fromPost = publicProfileForPost({ id: 'p', authorId: saved.id, author: '예전', avatar: 'old' } as MeetupPost, viewer, [saved]);
  const fromChat = publicProfileForMember({ id: saved.id, displayName: '?', avatar: '?' }, viewer, [saved]);
  const self = publicProfileForMember({ id: saved.id, displayName: '', avatar: '' }, saved);
  assert.deepEqual(fromPost, fromChat);
  assert.deepEqual(self, fromChat);
  assert.equal(fromPost.ageGroup, '20대');
  assert.equal(fromPost.sugarContent, 15);
  assert.equal(fromPost.isPhoneVerified, false);
  assert.equal(fromPost.avatar, saved.avatar);
  const serialized = JSON.stringify(fromPost);
  for (const secret of ['01099998888', '홍길동', '1998-04-12', 'hong@company.co.kr', 'SAFE-7788', 'referral']) assert.equal(serialized.includes(secret), false, secret);
  // A user who has not registered a photo gets the neutral placeholder, never someone else's picture.
  assert.equal(publicProfileForMember({ id: 'user-new', displayName: '', avatar: 'someone.jpg' }, null, [newUser()]).avatar, PLACEHOLDER_AVATAR);
});

test('a resized profile photo survives storage while a raw oversized original does not', () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
  const data: PrototypeData = {
    posts: [], requests: [], rooms: [], appointments: [], notifications: [], reviews: [], favorites: [], invitations: [], completions: [],
    appointmentReviews: [], notificationSettings: [], blocks: [], users: demoAccounts(), activeUserId: null, demo: defaultDemoSettings(), ui: { activeTab: 'me' },
  };
  const small = `data:image/jpeg;base64,${'a'.repeat(60_000)}`;
  const raw = `data:image/png;base64,${'b'.repeat(400_000)}`;
  data.users = [...data.users, newUser({ id: 'small', avatar: small }), newUser({ id: 'raw', avatar: raw })];
  assert.deepEqual(savePrototype(storage, 'k', data, NOW), { ok: true });
  const loaded = loadPrototype(storage, 'k').data!;
  assert.equal(loaded.users.find(user => user.id === 'small')!.avatar, small);
  assert.equal(loaded.users.find(user => user.id === 'raw')!.avatar, OVERSIZED_IMAGE);
  assert.deepEqual(missingProfileSteps(loaded.users.find(user => user.id === 'raw')!), ['photo', 'interests', 'bio']);
});
