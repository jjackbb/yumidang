// Feature 1 audit/regression: signup, incomplete-profile recovery, session restore, own-row RLS, masking.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { anonClient, ensureHarnessAvatar, signIn, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { loadEnv } from './helpers/env.mjs';
import { createClient } from '@supabase/supabase-js';

export async function feature01(ctx, feature) {
  // One fresh signup-probe account per run (explicitly creates one test Auth user + profile).
  const probePhone = `0199${String(parseInt(createHash('sha256').update(ctx.run.runId).digest('hex').slice(0, 12), 16) % 10_000_000).padStart(7, '0')}`;
  const probeName = '가입검증';
  ctx.run.guard.protect(probePhone, probeName, '1999-03-01');
  let probe;

  await feature.step('new number verifies to a real session with no profile yet (profile-incomplete)', 'REMOTE', async () => {
    probe = await signIn(probePhone, 'signup');
    const { data, error } = await probe.sdk.from('profiles').select('id').eq('id', probe.userId).maybeSingle();
    assert.equal(error, null);
    assert.equal(data, null);
  });
  await feature.step('session restores in a new client from the stored refresh token (reload)', 'REMOTE', async () => {
    const { data: current } = await probe.sdk.auth.getSession();
    const { url, key } = loadEnv();
    const reloaded = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await reloaded.auth.refreshSession({ refresh_token: current.session.refresh_token });
    assert.equal(error, null);
    assert.equal(data.user.id, probe.userId);
    probe.sdk = reloaded;
    const incomplete = await reloaded.from('profiles').select('id').eq('id', probe.userId).maybeSingle();
    assert.equal(incomplete.data, null, 'profile-incomplete state survives reload');
  });
  await feature.step('client cannot set created_at/updated_at or write another id', 'REMOTE', async () => {
    const forged = await probe.sdk.from('profiles').insert({ id: probe.userId, real_name: probeName, birth_date: '1999-03-01', created_at: '2001-01-01T00:00:00Z' });
    assert.ok(forged.error, 'created_at insert must be rejected');
    const a = await ctx.member('A');
    const other = await probe.sdk.from('profiles').insert({ id: a.userId, real_name: probeName, birth_date: '1999-03-01' });
    assert.ok(other.error, 'foreign id insert must be rejected');
  });
  await feature.step('owner completes signup atomically; DB manages timestamps; retry is idempotent', 'REMOTE', async () => {
    const avatarPath = await ensureHarnessAvatar(probe);
    const saved = await probe.sdk.rpc('complete_signup_with_avatar', {
      p_real_name: probeName, p_birth_date: '1999-03-01', p_gender: 'female', p_avatar_path: avatarPath,
      p_method: 'female_direct', p_referral_code: null,
    }).single();
    assert.equal(saved.error, null, saved.error?.message);
    assert.deepEqual(Object.keys(saved.data).sort(), ['avatar_url', 'bio', 'birth_date', 'created_at', 'gender', 'id', 'real_name', 'updated_at']);
    const again = await probe.sdk.rpc('complete_signup_with_avatar', {
      p_real_name: probeName, p_birth_date: '1999-03-01', p_gender: 'female', p_avatar_path: avatarPath,
      p_method: 'female_direct', p_referral_code: null,
    }).single();
    assert.equal(again.error, null);
    assert.equal(again.data.id, saved.data.id, 'retry returns the same profile');
    const touched = await probe.sdk.from('profiles').update({ updated_at: '2001-01-01T00:00:00Z' }).eq('id', probe.userId);
    assert.ok(touched.error, 'updated_at write must be rejected');
    const bio = await probe.sdk.from('profiles').update({ bio: '하네스 소개' }).eq('id', probe.userId).select('updated_at,created_at').single();
    assert.equal(bio.error, null);
    assert.ok(Date.parse(bio.data.updated_at) > Date.parse(saved.data.updated_at), 'trigger advanced updated_at');
    return { columns: Object.keys(saved.data).sort() };
  });
  await feature.step('real_name constraints reject blank/short/untrimmed values', 'REMOTE', async () => {
    for (const real_name of ['변', '  ', ' 변종현 '])
      assert.ok((await probe.sdk.from('profiles').update({ real_name }).eq('id', probe.userId)).error, 'invalid real_name accepted');
    assert.ok((await probe.sdk.from('profiles').update({ gender: 'other' }).eq('id', probe.userId)).error, 'invalid gender accepted');
    assert.ok((await probe.sdk.from('profiles').update({ gender: 'female' }).eq('id', probe.userId)).error, 'signup gender must be immutable');
  });
  await feature.step('A/B/C personas have profiles (idempotent setup)', 'REMOTE', async () => {
    for (const name of ['A', 'B', 'C']) {
      const member = await ctx.member(name);
      const own = await member.sdk.from('profiles').select('id,real_name').eq('id', member.userId).single();
      assert.equal(own.error, null);
      assert.equal(own.data.real_name, PERSONAS[name].realName);
    }
  });
  await feature.step('other members and anon cannot read or modify raw profiles', 'REMOTE', async () => {
    const a = await ctx.member('A');
    const b = await ctx.member('B');
    const read = await a.sdk.from('profiles').select('*').eq('id', b.userId);
    assert.deepEqual(read.data, []);
    const write = await a.sdk.from('profiles').update({ bio: '침범' }).eq('id', b.userId).select();
    assert.deepEqual(write.data, []);
    const all = await a.sdk.from('profiles').select('id');
    assert.deepEqual(all.data.map(row => row.id), [a.userId], 'only own row visible');
    const anon = await anonClient().from('profiles').select('*');
    assert.ok(anon.error || anon.data.length === 0);
  });
  await feature.step('server masking and Seoul full-age functions match the contract; anon cannot execute', 'REMOTE', async () => {
    const a = await ctx.member('A');
    for (const [input, expected] of [['변종', '변*'], ['변종현', '변*현'], ['변종현미', '변**미']]) {
      const { data, error } = await a.sdk.rpc('mask_real_name', { p_name: input });
      assert.equal(error, null);
      assert.equal(data, expected);
    }
    assert.equal((await a.sdk.rpc('korean_age', { p_birth_date: '2000-02-29', p_on: '2026-02-28' })).data, 25);
    assert.equal((await a.sdk.rpc('korean_age', { p_birth_date: '2000-02-29', p_on: '2026-03-01' })).data, 26);
    assert.ok((await anonClient().rpc('mask_real_name', { p_name: '변종현' })).error, 'anon execute must be denied');
  });
  await feature.step('logout revokes the refresh token', 'REMOTE', async () => {
    const { data } = await probe.sdk.auth.getSession();
    const refresh = data.session.refresh_token;
    assert.equal((await probe.sdk.auth.signOut()).error, null);
    const retry = await anonClient().auth.refreshSession({ refresh_token: refresh });
    assert.ok(retry.error, 'revoked refresh token must fail');
  });
}

standalone(import.meta.url, 'feature-01-auth', feature01);
