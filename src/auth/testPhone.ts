import { getSupabaseClient } from '../lib/supabase';

export const isTestPhoneAuthEnabled = () => import.meta.env.VITE_TEST_PHONE_AUTH === 'true';

export async function testPhoneAuth(action: 'request' | 'verify', phone: string, code?: string) {
  const { data, error } = await getSupabaseClient().functions.invoke('test-phone-auth', {
    body: { action, phone, code },
  });
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (body?.message) throw new Error(body.message);
    }
    throw new Error('테스트 인증 서버에 연결하지 못했어요. 서버 활성화 상태를 확인해 주세요.');
  }
  return data;
}
