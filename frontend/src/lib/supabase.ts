import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const YUMIDANG_SUPABASE_REF = 'bndguguarijmghnkenvt';
export const YUMIDANG_SUPABASE_URL = `https://${YUMIDANG_SUPABASE_REF}.supabase.co`;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

export function validateSupabaseConfig(urlValue: string | undefined, keyValue: string | undefined) {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();

  if (!url || !publishableKey) {
    throw new SupabaseConfigError('Supabase 환경변수가 없어요. .env.local의 URL과 publishable key를 확인해 주세요.');
  }
  if (url !== YUMIDANG_SUPABASE_URL) {
    throw new SupabaseConfigError(`허용되지 않은 Supabase 프로젝트예요. ${YUMIDANG_SUPABASE_REF} 프로젝트만 사용할 수 있어요.`);
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new SupabaseConfigError('브라우저에는 sb_publishable_ 형식의 publishable key만 사용할 수 있어요.');
  }

  return { url, publishableKey };
}

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) return client;
  const { url, publishableKey } = validateSupabaseConfig(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
