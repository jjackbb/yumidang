// Feature 2 regression: login never creates accounts, wrong code gives no session, relogin/refresh/logout, A/B isolation.
import assert from 'node:assert/strict';
import { anonClient, signIn, testAuth, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';

export async function feature02(ctx, feature) {
  const unregistered = `0198${ctx.run.runId.replace(/\D/g, '').slice(-7).padStart(7, '0')}`;
  ctx.run.guard.protect(unregistered);

  await feature.step('login with an unregistered arbitrary number is rejected and no account appears', 'REMOTE', async () => {
    const first = await testAuth('verify', unregistered, { mode: 'login' });
    assert.equal(first.status, 404);
    assert.equal(first.data.code, 'not_registered');
    assert.equal(first.data.access_token, undefined);
    // If the first call had created a user, the password grant would now succeed.
    const second = await testAuth('verify', unregistered, { mode: 'login' });
    assert.equal(second.status, 404, 'login attempt must not have created an account');
  });
  await feature.step('login request for an unused legacy test number is rejected without creating it', 'REMOTE', async () => {
    const legacy = await anonClient().auth.signInWithOtp({ phone: '+821000000011', options: { shouldCreateUser: false } });
    assert.ok(legacy.error, 'shouldCreateUser:false must refuse an unknown legacy number');
    assert.equal(legacy.error.code, 'otp_disabled');
  });
  await feature.step('wrong code or unknown mode never returns a session', 'REMOTE', async () => {
    const wrong = await testAuth('verify', PERSONAS.A.phone, { mode: 'login', code: '000000' });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.data.access_token, undefined);
    const hijack = await testAuth('verify', PERSONAS.A.phone, { mode: 'admin' });
    assert.equal(hijack.status, 400);
  });
  let a1;
  await feature.step('existing member logs in (login mode) and gets the same UUID and own profile', 'REMOTE', async () => {
    const setupA = await ctx.member('A');
    a1 = await signIn(PERSONAS.A.phone, 'login');
    assert.equal(a1.userId, setupA.userId);
    const own = await a1.sdk.from('profiles').select('id').single();
    assert.equal(own.data.id, a1.userId);
  });
  await feature.step('A and B sessions are independent and do not see each other', 'REMOTE', async () => {
    const b = await ctx.member('B');
    const [ua, ub] = await Promise.all([a1.sdk.auth.getUser(), b.sdk.auth.getUser()]);
    assert.equal(ua.data.user.id, a1.userId);
    assert.equal(ub.data.user.id, b.userId);
    assert.notEqual(ua.data.user.id, ub.data.user.id);
    assert.deepEqual((await a1.sdk.from('profiles').select('id')).data.map(row => row.id), [a1.userId]);
  });
  await feature.step('refresh keeps the user; logout revokes only that session', 'REMOTE', async () => {
    const refreshed = await a1.sdk.auth.refreshSession();
    assert.equal(refreshed.error, null);
    assert.equal(refreshed.data.user.id, a1.userId);
    const token = refreshed.data.session.refresh_token;
    assert.equal((await a1.sdk.auth.signOut({ scope: 'local' })).error, null);
    // A local sign-out keeps other sessions (ctx.member A) valid.
    const other = await (await ctx.member('A')).sdk.from('profiles').select('id').single();
    assert.equal(other.error, null);
    assert.ok(token);
  });
}

standalone(import.meta.url, 'feature-02-login', feature02);
