export const PROJECT_URL = 'https://bndguguarijmghnkenvt.supabase.co';
export const TEST_EMAIL_CODE = '246810';

export interface TestEmailAuthConfig {
  url?: string;
  anonKey?: string;
  serviceKey?: string;
  enabled?: string;
  expiresAt?: string;
}

const statusMessage: Record<string, string> = {
  email_request_missing: '같은 이메일로 확인 코드를 먼저 요청해 주세요.',
  email_code_expired: '확인 코드가 만료됐어요. 다시 요청해 주세요.',
  email_attempts_exceeded: '확인 시도 횟수를 초과했어요. 잠시 후 코드를 다시 요청해 주세요.',
  invalid_email_code: '이메일 확인 코드가 맞지 않아요.',
  institutional_email_already_used: '이미 가입에 사용된 기관 이메일이에요.',
};

export function createTestEmailAuthHandler(config: TestEmailAuthConfig, fetcher: typeof fetch = fetch, now = () => Date.now()) {
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

    const featureExpiry = Date.parse(config.expiresAt || '');
    if (config.enabled !== 'true' || !Number.isFinite(featureExpiry) || now() >= featureExpiry)
      return reply(503, { message: '테스트 이메일 확인 기능이 비활성화되어 있어요.' });
    if (config.url !== PROJECT_URL || !config.anonKey || !config.serviceKey)
      return reply(503, { message: '테스트 이메일 확인 서버 설정을 확인해 주세요.' });

    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, { message: '로그인이 필요해요.' });

    let body: { action?: string; email?: string; code?: string };
    try {
      const raw = await request.text();
      if (raw.length > 1024) return reply(413, { message: '요청이 너무 커요.' });
      body = JSON.parse(raw);
    } catch { return reply(400, { message: '올바른 요청이 아니에요.' }); }
    if (!body || !['request', 'verify'].includes(body.action || '') || typeof body.email !== 'string')
      return reply(400, { message: '올바른 이메일 확인 요청이 아니에요.' });
    const normalizedEmail = body.email.trim().toLowerCase();

    try {
      const userResponse = await fetcher(`${PROJECT_URL}/auth/v1/user`, {
        headers: { apikey: config.anonKey, Authorization: authorization },
      });
      const user = await userResponse.json();
      if (!userResponse.ok || typeof user?.id !== 'string') return reply(401, { message: '로그인 세션을 확인해 주세요.' });

      const rpc = async (name: string, payload: object) => {
        const response = await fetcher(`${PROJECT_URL}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers: {
            apikey: config.serviceKey!,
            Authorization: `Bearer ${config.serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          const code = typeof data?.message === 'string' ? data.message : '';
          const messages: Record<string, string> = {
            invalid_institutional_email: '기관 이메일 형식을 확인해 주세요.',
            free_email_not_allowed: '개인 무료 이메일은 사용할 수 없어요. 학교나 직장 이메일을 입력해 주세요.',
            institutional_email_already_used: '이미 가입에 사용된 기관 이메일이에요.',
            email_request_rate_limited: '요청이 너무 빨라요. 30초 후 다시 시도해 주세요.',
          };
          return { response, data, safeMessage: messages[code] || '이메일 확인 서버에서 요청을 처리하지 못했어요.' };
        }
        return { response, data, safeMessage: '' };
      };

      if (body.action === 'request') {
        const result = await rpc('request_test_institutional_email_verification', { p_user_id: user.id, p_email: normalizedEmail });
        if (!result.response.ok) return reply(result.response.status === 429 ? 429 : 400, { message: result.safeMessage });
        return reply(200, { message: '실제 메일은 보내지 않아요. 테스트 확인 코드 246810을 입력해 주세요.', expires_in_seconds: 600 });
      }

      const result = await rpc('verify_test_institutional_email', {
        p_user_id: user.id,
        p_email: normalizedEmail,
        p_code_valid: body.code === TEST_EMAIL_CODE,
      });
      if (!result.response.ok) return reply(400, { message: result.safeMessage });
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row?.verified) return reply(400, { message: statusMessage[row?.status] || '이메일을 확인하지 못했어요.' });
      return reply(200, { verified: true, message: '기관 이메일 확인이 완료됐어요.' });
    } catch {
      return reply(502, { message: '이메일 확인 서버에 연결하지 못했어요. 다시 시도해 주세요.' });
    }
  };
}
