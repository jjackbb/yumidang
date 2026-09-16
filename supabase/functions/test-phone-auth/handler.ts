// Test-only authentication. 123456 proves knowledge of the shared test code, NOT phone ownership.
// This endpoint must never be enabled for a project holding real customer accounts/data.
export const PROJECT_URL = 'https://bndguguarijmghnkenvt.supabase.co';
export const TEST_CODE = '123456';
export const isLegacyTestPhone = (phone: string) => /^010000000(?:0[1-9]|1\d|20)$/.test(phone);
export const testPhoneE164 = (phone: string) => `+82${phone.startsWith('0') ? phone.slice(1) : phone}`;

export interface TestAuthConfig {
  url?: string;
  serviceKey?: string;
  anonKey?: string;
  passwordSecret?: string;
  enabled?: string;
  expiresAt?: string;
}

export function createTestAuthHandler(config: TestAuthConfig, fetcher: typeof fetch = fetch, now = () => Date.now()) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    };
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { message: 'POST만 지원합니다.' });
    const expiry = Date.parse(config.expiresAt || '');
    if (config.enabled !== 'true' || !Number.isFinite(expiry) || now() >= expiry)
      return reply(503, { message: '테스트 로그인이 비활성화되어 있어요.' });
    if (config.url !== PROJECT_URL || !config.serviceKey || !config.anonKey || (config.passwordSecret?.length ?? 0) < 32)
      return reply(503, { message: '테스트 인증 서버 설정을 확인해 주세요.' });

    let body: { action?: string; phone?: string; code?: string };
    try {
      const raw = await request.text();
      if (raw.length > 1024) return reply(413, { message: '요청이 너무 커요.' });
      body = JSON.parse(raw);
    } catch { return reply(400, { message: '올바른 요청이 아니에요.' }); }
    if (!body || typeof body.phone !== 'string' || !/^\d{11}$/.test(body.phone))
      return reply(400, { message: '숫자 11자리를 입력해 주세요.' });
    if (!['request', 'verify'].includes(body.action || ''))
      return reply(400, { message: '올바른 인증 단계가 아니에요.' });
    if (body.action === 'verify' && body.code !== TEST_CODE)
      return reply(400, { message: '인증번호가 맞지 않아요. 123456을 입력해 주세요.' });

    const phone = testPhoneE164(body.phone);
    const callAuth = async (path: string, payload: object, admin = false) => {
      const key = admin ? config.serviceKey! : config.anonKey!;
      const response = await fetcher(`${PROJECT_URL}/auth/v1/${path}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { response, data };
    };
    const failure = (status: number) => reply(status === 429 ? 429 : 400, {
      message: status === 429 ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' : '테스트 로그인에 실패했어요. 기존 테스트 계정인지 확인해 주세요.',
    });
    try {
      if (body.action === 'request') {
        if (isLegacyTestPhone(body.phone)) {
          const sent = await callAuth('otp', { phone, create_user: true });
          if (!sent.response.ok) return failure(sent.response.status);
        }
        return reply(200, { message: '실제 문자는 보내지 않아요. 테스트 인증번호 123456을 입력해 주세요.' });
      }

      let result;
      if (isLegacyTestPhone(body.phone)) {
        // Preserve the 20 existing users and their native OTP configuration.
        result = await callAuth('verify', { phone, token: body.code, type: 'sms' });
      } else {
        // A per-phone server-only password obtains a genuine Supabase session.
        // Never reset an existing user's password or use a client-supplied user ID.
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(config.passwordSecret!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`yumidang-test-phone-v1:${phone}`));
        const password = `Test!${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}`;
        const created = await callAuth('admin/users', {
          phone, password, phone_confirm: true,
          app_metadata: { test_phone_auth: true, phone_ownership_verified: false },
        }, true);
        if (!created.response.ok && !['phone_exists', 'user_already_exists'].includes(created.data.error_code || created.data.code))
          return failure(created.response.status);
        result = await callAuth('token?grant_type=password', { phone, password });
        if (result.response.ok && result.data.user?.app_metadata?.test_phone_auth !== true)
          return reply(403, { message: '이 계정은 임의 번호 테스트 로그인 대상이 아니에요.' });
      }
      if (!result.response.ok) return failure(result.response.status);
      if (!result.data.access_token || !result.data.refresh_token || !result.data.user?.id)
        return reply(502, { message: '인증 세션을 확인하지 못했어요.' });
      return reply(200, { access_token: result.data.access_token, refresh_token: result.data.refresh_token });
    } catch {
      return reply(502, { message: '인증 서버에 연결하지 못했어요. 다시 시도해 주세요.' });
    }
  };
}
