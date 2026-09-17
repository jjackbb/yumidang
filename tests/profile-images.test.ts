import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { runPhotoSignup, PhotoSignupFlowError } from '../src/auth/signupPhotoFlow.ts';
import {
  createProfileImagePath, isDirectlyRenderableAvatar, isOwnProfileImagePath, isProfileImagePath,
  PROFILE_IMAGE_MAX_STORED_BYTES,
} from '../src/profile/avatarPath.ts';
import {
  clearMyProfileImage,
  profileImageDeleteNotice,
  profileImageErrorMessage,
  uploadProfileImage,
  type ProfileImageUploadDependencies,
} from '../src/profile/avatarStorage.ts';
import { containedImageSize, PROFILE_IMAGE_JPEG_QUALITY, PROFILE_IMAGE_MAX_EDGE } from '../src/utils/imageResize.ts';
import { avatarSrc, PLACEHOLDER_AVATAR, profileStepsForMode } from '../src/utils/profile.ts';
import type { CurrentUser } from '../src/types.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
const PATH = `${USER_ID}/${OBJECT_ID}.jpg`;
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_PATH = `${OTHER_USER_ID}/${OBJECT_ID}.jpg`;
const NEW_OBJECT_ID = '44444444-4444-4444-8444-444444444444';
const NEW_PATH = `${USER_ID}/${NEW_OBJECT_ID}.jpg`;
const JPEG = new Blob(['jpeg'], { type: 'image/jpeg' });

test('private avatar paths are owner-scoped, cache-safe, and never rendered raw', () => {
  assert.equal(createProfileImagePath(USER_ID, OBJECT_ID), PATH);
  assert.equal(isProfileImagePath(PATH), true);
  assert.equal(isOwnProfileImagePath(PATH, USER_ID), true);
  assert.equal(isOwnProfileImagePath(PATH, '33333333-3333-4333-8333-333333333333'), false);
  assert.equal(isDirectlyRenderableAvatar(PATH), false);
  assert.equal(isDirectlyRenderableAvatar('https://legacy.example/avatar.jpg'), true);
  assert.equal(avatarSrc(PATH), PLACEHOLDER_AVATAR);
  assert.equal(PROFILE_IMAGE_MAX_STORED_BYTES, 2 * 1024 * 1024);
});

test('resize geometry caps the long edge at 480 and preserves aspect ratio', () => {
  assert.deepEqual(containedImageSize(1600, 800), { width: 480, height: 240 });
  assert.deepEqual(containedImageSize(300, 600), { width: 240, height: 480 });
  assert.deepEqual(containedImageSize(200, 100), { width: 200, height: 100 });
  assert.equal(PROFILE_IMAGE_MAX_EDGE, 480);
  assert.equal(PROFILE_IMAGE_JPEG_QUALITY, 0.82);
});

test('upload reuses only a valid current-user path and uploads invalid reusable paths to a fresh path', async () => {
  const uploads: Array<{ path: string; blob: Blob }> = [];
  const dependencies: ProfileImageUploadDependencies = {
    authenticatedUserId: async () => USER_ID,
    createPath: userId => {
      assert.equal(userId, USER_ID);
      return NEW_PATH;
    },
    upload: async (path, blob) => { uploads.push({ path, blob }); },
  };

  assert.equal(await uploadProfileImage(JPEG, PATH, dependencies), PATH);
  assert.equal(uploads.length, 0, 'valid own retry path must skip duplicate upload');

  assert.equal(await uploadProfileImage(JPEG, OTHER_PATH, dependencies), NEW_PATH);
  assert.equal(await uploadProfileImage(JPEG, 'not-a-profile-image-path', dependencies), NEW_PATH);
  assert.deepEqual(uploads.map(item => item.path), [NEW_PATH, NEW_PATH]);
  assert.ok(uploads.every(item => item.blob === JPEG), 'invalid reusable paths must actually upload the prepared blob');
});

test('upload failure never calls signup completion', async () => {
  let completed = false;
  await assert.rejects(
    runPhotoSignup(JPEG, '', {
      upload: async () => { throw new Error('network'); },
      complete: async () => { completed = true; return {}; },
    }, () => {}),
    (error: unknown) => error instanceof PhotoSignupFlowError && error.phase === 'upload',
  );
  assert.equal(completed, false);
});

test('RPC failure retains the uploaded path and retry does not upload again', async () => {
  let uploadCount = 0;
  let retained = '';
  await assert.rejects(runPhotoSignup(JPEG, retained, {
    upload: async () => { uploadCount++; return PATH; },
    complete: async () => { throw new Error('rpc unavailable'); },
  }, path => { retained = path; }), (error: unknown) => error instanceof PhotoSignupFlowError && error.phase === 'complete');
  assert.equal(retained, PATH);

  const retry = await runPhotoSignup(JPEG, retained, {
    upload: async () => { uploadCount++; return PATH; },
    complete: async avatarPath => ({ avatar_url: avatarPath }),
  }, path => { retained = path; });
  assert.equal(uploadCount, 1);
  assert.equal(retry.profile.avatar_url, PATH);
});

test('successful service signup skips the old post-signup photo funnel and legacy users are grandfathered', () => {
  const base = {
    id: USER_ID, isLoggedIn: true, phone: '', realName: '홍길동', maskedName: '홍*동', nickname: '홍*동', gender: 'female' as const,
    ageGroup: '20대', neighborhood: '', sugarContent: 15, isPhoneVerified: true, isKycVerified: false,
    avatar: 'blob:signed-preview', avatarPath: PATH, bio: '', hobbies: [], traits: [], joinedAt: '',
  } satisfies CurrentUser;
  const legacy: CurrentUser = { ...base, avatar: '', avatarPath: undefined };
  assert.deepEqual(profileStepsForMode(base, false), []);
  assert.deepEqual(profileStepsForMode(legacy, false), []);
  assert.deepEqual(profileStepsForMode(legacy, true), ['photo', 'interests', 'bio']);
});

test('delete RPC failure says the photo was not deleted and remains retryable', async () => {
  let removeCalled = false;
  const rpcError = new Error('forced RPC failure');
  await assert.rejects(clearMyProfileImage({
    clearProfileAvatar: async () => { throw rpcError; },
    removeOwn: async () => { removeCalled = true; },
  }), rpcError);
  assert.equal(removeCalled, false, 'object cleanup must not run when the profile RPC failed');
  const message = profileImageErrorMessage(rpcError, 'delete');
  assert.match(message, /삭제하지 못했어요/);
  assert.match(message, /그대로 유지/);
  assert.match(message, /다시 시도/);
  assert.doesNotMatch(message, /삭제됐|프로필에서는 사진을 지웠/);
});

test('object cleanup failure is distinct from RPC failure after the profile path was cleared', async () => {
  const result = await clearMyProfileImage({
    clearProfileAvatar: async () => ({ avatar_url: null, previous_avatar_path: PATH }),
    removeOwn: async () => { throw new Error('forced object cleanup failure'); },
  });
  assert.equal(result.cleanup, 'failed');
  assert.equal(result.previousAvatarPath, PATH);
  const notice = profileImageDeleteNotice(result.cleanup);
  assert.match(notice, /프로필 사진은 삭제됐지만/);
  assert.match(notice, /저장 파일 정리만 지연/);
  assert.doesNotMatch(notice, /삭제하지 못했어요|그대로 유지/);
});

test('expansion migration defines private bucket, owner policies, validating versioned RPCs, and transitional old-RPC safety', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260917052827_profile_images_required.sql', import.meta.url), 'utf8');
  assert.match(sql, /values \('profile-images', 'profile-images', false, 2097152, array\['image\/jpeg'\]/);
  assert.match(sql, /for select to authenticated[\s\S]*bucket_id = 'profile-images'/);
  assert.match(sql, /for insert to authenticated[\s\S]*auth\.uid\(\)::text/);
  assert.match(sql, /for delete to authenticated[\s\S]*owner_id = auth\.uid\(\)::text/);
  assert.doesNotMatch(sql, /for (?:all|update) to authenticated/, 'client uses unique INSERT paths, never Storage upsert');
  assert.match(sql, /from storage\.objects o[\s\S]*owner_id[\s\S]*metadata/);
  assert.match(sql, /profile_image_missing/);
  assert.match(sql, /profile_image_not_owned/);
  assert.match(sql, /complete_signup_with_avatar[\s\S]*avatar_url\)[\s\S]*v_avatar_path/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /revoke update \(avatar_url\)/);
  assert.match(sql, /Keep complete_signup\(\.\.\.\) executable/, 'old RPC is deliberately retained only for zero-downtime expansion');
  assert.doesNotMatch(sql, /drop function public\.complete_signup\(/);
});

test('contraction revokes only authenticated legacy signup execution', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260917094753_disable_legacy_signup_without_avatar.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke execute on function public\.complete_signup\(text,date,text,text,text\) from authenticated/);
  assert.doesNotMatch(sql, /revoke[^;]*service_role/);
  assert.doesNotMatch(sql, /drop function public\.complete_signup/);
});

test('production and reusable harness signup paths no longer call the legacy RPC', () => {
  const production = readFileSync(new URL('../src/auth/signupEligibility.ts', import.meta.url), 'utf8');
  const sessions = readFileSync(new URL('./harness/helpers/sessions.mjs', import.meta.url), 'utf8');
  const feature01 = readFileSync(new URL('./harness/feature-01-auth.mjs', import.meta.url), 'utf8');
  for (const source of [production, sessions, feature01]) {
    assert.doesNotMatch(source, /\.rpc\(['"]complete_signup['"]/);
  }
  assert.match(production, /\.rpc\('complete_signup_with_avatar'/);
  assert.match(sessions, /\.rpc\('complete_signup_with_avatar'/);
  assert.match(feature01, /\.rpc\('complete_signup_with_avatar'/);
});

test('storage adapter requests JPEG upload without upsert and centralizes signed URL creation', () => {
  const source = readFileSync(new URL('../src/profile/avatarStorage.ts', import.meta.url), 'utf8');
  assert.match(source, /contentType: 'image\/jpeg'/);
  assert.match(source, /upsert: false/);
  assert.match(source, /createSignedUrl\(value, SIGNED_URL_TTL_SECONDS\)/);
  assert.doesNotMatch(source, /getPublicUrl/);
});
