import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestAuthHandler, PROJECT_URL, type TestAuthConfig } from '../supabase/functions/test-phone-auth/handler.ts';

const config: TestAuthConfig = { url: PROJECT_URL, serviceKey: 'server-secret', anonKey: 'public-key', passwordSecret: 'unit-test-only-password-secret-32-characters', enabled: 'true', expiresAt: '2026-09-23T00:00:00Z' };
const now = () => Date.parse('2026-09-16T00:00:00Z');
const request = (phone: string, code = '123456', action = 'verify', mode?: string) => new Request('http://localhost/test-phone-auth', {
  method: 'POST', body: JSON.stringify({ action, phone, code, mode }),
});
const unreachable: typeof fetch = async () => { throw new Error('Auth must not be called'); };

test('test auth fails closed when disabled, expired, or pointing at another project', async () => {
  for (const overrides of [{ enabled: undefined }, { passwordSecret: undefined }, { expiresAt: undefined }, { expiresAt: 'invalid' }, { expiresAt: '2026-09-15' }, { url: 'https://other.supabase.co' }]) {
    const handler = createTestAuthHandler({ ...config, ...overrides }, unreachable, now);
    assert.equal((await handler(request('01012345678'))).status, 503);
  }
});

test('wrong fixed code and malformed phone never create an Auth user', async () => {
  let calls = 0;
  const handler = createTestAuthHandler(config, async () => { calls++; throw new Error(); }, now);
  assert.equal((await handler(request('01012345678', '654321'))).status, 400);
  assert.equal((await handler(request('0101234567'))).status, 400);
  assert.equal((await handler(request('010-1234-5678'))).status, 400);
  assert.equal(calls, 0);
});

test('requesting a code for any 11 digits sends no SMS and creates no user', async () => {
  const handler = createTestAuthHandler(config, unreachable, now);
  assert.equal((await handler(request('98765432109', '', 'request'))).status, 200);
});

test('mock Auth: new and returning numbers forward tokens with a stable server password', async () => {
  const passwords: string[] = [];
  let users = 0;
  const backend: typeof fetch = async (url, options) => {
    assert.ok(String(url).startsWith(PROJECT_URL));
    const body = JSON.parse(String(options?.body));
    assert.equal(body.phone, '+821012345678');
    assert.notEqual(body.password, '123456');
    passwords.push(body.password);
    if (String(url).endsWith('admin/users')) {
      assert.deepEqual(body.app_metadata, { test_phone_auth: true, phone_ownership_verified: false });
      return users++ === 0 ? Response.json({ id: 'user-A' }) : Response.json({ error_code: 'phone_exists' }, { status: 422 });
    }
    return Response.json({ access_token: 'auth-issued-A', refresh_token: 'refresh-A', user: { id: 'user-A', app_metadata: { test_phone_auth: true } } });
  };
  const handler = createTestAuthHandler(config, backend, now);
  for (let i = 0; i < 2; i++) {
    const response = await handler(request('01012345678'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { access_token: 'auth-issued-A', refresh_token: 'refresh-A' });
  }
  assert.equal(new Set(passwords).size, 1);
});

test('different phone numbers produce different server-only passwords', async () => {
  const passwords: string[] = [];
  const handler = createTestAuthHandler(config, async (url, options) => {
    if (String(url).endsWith('admin/users')) {
      passwords.push(JSON.parse(String(options?.body)).password);
      return Response.json({ id: 'test' });
    }
    return Response.json({ access_token: 'token', refresh_token: 'refresh', user: { id: 'test', app_metadata: { test_phone_auth: true } } });
  }, now);
  await handler(request('01012345678'));
  await handler(request('01012345679'));
  assert.notEqual(passwords[0], passwords[1]);
});

test('existing 20 test numbers use native OTP without admin user writes', async () => {
  const calls: string[] = [];
  const handler = createTestAuthHandler(config, async (url) => {
    calls.push(String(url));
    return Response.json({ access_token: 'native-token', refresh_token: 'native-refresh', user: { id: 'existing-user' } });
  }, now);
  await handler(request('01000000001', '', 'request'));
  assert.equal((await handler(request('01000000001'))).status, 200);
  assert.deepEqual(calls, [`${PROJECT_URL}/auth/v1/otp`, `${PROJECT_URL}/auth/v1/verify`]);
});

test('rate limits propagate and provider secrets never appear in errors', async () => {
  const handler = createTestAuthHandler(config, async () => Response.json({ message: 'server-secret' }, { status: 429 }), now);
  const response = await handler(request('01012345678'));
  assert.equal(response.status, 429);
  assert.doesNotMatch(await response.text(), /server-secret/);
});

test('a pre-existing non-test account is never reset or returned to the caller', async () => {
  const methods: string[] = [];
  const handler = createTestAuthHandler(config, async (url, options) => {
    methods.push(options?.method || '');
    if (String(url).endsWith('admin/users')) return Response.json({ error_code: 'phone_exists' }, { status: 422 });
    return Response.json({ access_token: 'must-not-leak', refresh_token: 'must-not-leak', user: { id: 'real-account', app_metadata: {} } });
  }, now);
  const response = await handler(request('01012345678'));
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /must-not-leak/);
  assert.deepEqual(methods, ['POST', 'POST']);
});

test('login mode never creates an Auth user and reports unregistered numbers', async () => {
  const calls: string[] = [];
  const handler = createTestAuthHandler(config, async (url, options) => {
    calls.push(String(url).replace(PROJECT_URL, ''));
    if (String(url).includes('grant_type=password')) return Response.json({ error_code: 'invalid_credentials' }, { status: 400 });
    if (String(url).endsWith('/otp')) {
      assert.equal(JSON.parse(String(options?.body)).create_user, false);
      return Response.json({ error_code: 'otp_disabled' }, { status: 422 });
    }
    throw new Error('unexpected call');
  }, now);
  const unknown = await handler(request('01012345678', '123456', 'verify', 'login'));
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, 'not_registered');
  assert.equal((await handler(request('01000000011', '', 'request', 'login'))).status, 404);
  assert.equal((await handler(request('01012345678', '123456', 'verify', 'hijack'))).status, 400);
  assert.ok(calls.every(path => !path.includes('admin/users')));
});

test('login mode returns the session of an existing test account', async () => {
  const handler = createTestAuthHandler(config, async (url) => {
    assert.ok(!String(url).endsWith('admin/users'));
    return Response.json({ access_token: 'existing', refresh_token: 'existing-refresh', user: { id: 'user-A', app_metadata: { test_phone_auth: true } } });
  }, now);
  assert.equal((await handler(request('01012345678', '123456', 'verify', 'login'))).status, 200);
});
