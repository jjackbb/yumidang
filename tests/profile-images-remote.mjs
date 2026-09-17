import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { anonClient, signIn } from './harness/helpers/sessions.mjs';

const BUCKET = 'profile-images';
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const ownerPhone = process.env.LIVE_OWNER_PHONE;
const otherPhone = process.env.LIVE_OTHER_PHONE;
assert.match(ownerPhone || '', /^\d{11}$/, 'LIVE_OWNER_PHONE must be an existing controlled test account');
assert.match(otherPhone || '', /^\d{11}$/, 'LIVE_OTHER_PHONE must be an existing controlled test account');
assert.notEqual(ownerPhone, otherPhone, 'RLS test accounts must differ');

const a = await signIn(ownerPhone, 'login');
const b = await signIn(otherPhone, 'login');
const ownPath = `${a.userId}/${randomUUID()}.jpg`;
const foreignPath = `${a.userId}/${randomUUID()}.jpg`;
const jpeg = () => new Blob([JPEG_BYTES], { type: 'image/jpeg' });
const objectExists = async objectPath => {
  const separator = objectPath.indexOf('/');
  const folder = objectPath.slice(0, separator);
  const file = objectPath.slice(separator + 1);
  const listed = await a.sdk.storage.from(BUCKET).list(folder, { search: file, limit: 10 });
  assert.equal(listed.error, null, 'authenticated object listing must succeed');
  return listed.data.some(item => item.name === file);
};

let uploaded = false;
try {
  const posts = await anonClient().rpc('list_posts', {
    p_after_starts_at: null,
    p_after_id: null,
    p_limit: 50,
  });
  assert.equal(posts.error, null, 'existing public post list must remain readable');
  assert.ok((posts.data?.length || 0) > 0, 'existing public post list must not be empty');

  const ownProfile = await a.sdk.from('profiles').select('id,real_name,birth_date,gender,avatar_url').eq('id', a.userId).single();
  assert.equal(ownProfile.error, null, 'existing member profile must remain readable');

  const legacySignup = await a.sdk.rpc('complete_signup', {
    p_real_name: ownProfile.data.real_name,
    p_birth_date: ownProfile.data.birth_date,
    p_gender: ownProfile.data.gender,
    p_method: null,
    p_referral_code: null,
  });
  assert.ok(legacySignup.error, 'authenticated legacy no-photo signup RPC must be revoked');

  const versionedSignup = await a.sdk.rpc('complete_signup_with_avatar', {
    p_real_name: ownProfile.data.real_name,
    p_birth_date: ownProfile.data.birth_date,
    p_gender: ownProfile.data.gender,
    p_avatar_path: 'existing-profile-idempotent-check',
    p_method: null,
    p_referral_code: null,
  });
  assert.equal(versionedSignup.error, null, 'versioned signup RPC must remain executable for an existing profile');

  const directAvatarUpdate = await a.sdk.from('profiles').update({ avatar_url: ownPath }).eq('id', a.userId);
  assert.ok(directAvatarUpdate.error, 'direct avatar_url update must stay denied');

  const upload = await a.sdk.storage.from(BUCKET).upload(ownPath, jpeg(), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  assert.equal(upload.error, null, 'owner upload must succeed');
  uploaded = true;

  const anonymousRead = await anonClient().storage.from(BUCKET).download(ownPath);
  assert.ok(anonymousRead.error, 'anonymous profile-image read must be denied');

  const authenticatedRead = await b.sdk.storage.from(BUCKET).download(ownPath);
  assert.equal(authenticatedRead.error, null, 'authenticated profile-image read is the documented wide-read policy');

  const foreignUpload = await b.sdk.storage.from(BUCKET).upload(foreignPath, jpeg(), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  assert.ok(foreignUpload.error, 'uploading into another member folder must be denied');

  const foreignPointer = await b.sdk.rpc('set_my_profile_avatar', { p_avatar_path: ownPath });
  assert.ok(foreignPointer.error, 'another member object cannot become the caller profile image');

  await b.sdk.storage.from(BUCKET).remove([ownPath]);
  assert.equal(await objectExists(ownPath), true, 'another member delete must not remove the owner object');

  const signed = await a.sdk.storage.from(BUCKET).createSignedUrl(ownPath, 60);
  assert.equal(signed.error, null, 'authenticated signed URL creation must succeed');
  assert.equal((await fetch(signed.data.signedUrl)).status, 200, 'signed URL must serve the stored object');

  const removed = await a.sdk.storage.from(BUCKET).remove([ownPath]);
  assert.equal(removed.error, null, 'owner delete must succeed');
  uploaded = false;
  assert.equal(await objectExists(ownPath), false, 'deleted owner object must be absent');

  console.log(JSON.stringify({
    result: 'PASS',
    publicPostsReadable: posts.data.length,
    existingLogin: true,
    legacySignupRevoked: true,
    versionedSignupExecutable: true,
    ownerUploadDelete: true,
    anonymousReadDenied: true,
    foreignWriteDeleteDenied: true,
    authenticatedWideReadObserved: true,
  }));
} finally {
  if (uploaded) await a.sdk.storage.from(BUCKET).remove([ownPath]);
  await Promise.all([
    a.sdk.auth.signOut({ scope: 'local' }),
    b.sdk.auth.signOut({ scope: 'local' }),
  ]);
}
