import { createClient } from '@supabase/supabase-js';
import { externalServicesBlocked } from '../utils/demoMode';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
let configurationError: string | null = null;
if (!url || !key) configurationError = '로그인 서비스 연결 설정이 필요해요. 관리자에게 문의해 주세요.';
else {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid URL');
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('Only public keys are allowed');
    }
  } catch { configurationError = '로그인 서비스의 공개 연결 설정을 확인해 주세요.'; }
}

export const supabaseConfigurationError = configurationError;
// No fallback project and no client (including token refresh) in the isolated demo.
export const supabase = !externalServicesBlocked() && !configurationError
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;
