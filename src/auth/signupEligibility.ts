import { getSupabaseClient } from '../lib/supabase';
import { PROFILE_COLUMNS, type SignupProfile } from './signup';
import { normalizeInstitutionalEmail, normalizeReferralCode, type MaleSignupMethod } from './signupEligibilityValidation';
export * from './signupEligibilityValidation';

const safeSignupMessages: Record<string, string> = {
  invalid_referral: '유효한 여성 회원 추천 코드를 입력해 주세요.',
  email_verification_required: '기관 이메일 확인을 먼저 완료해 주세요.',
  institutional_email_already_used: '이미 가입에 사용된 기관 이메일이에요.',
  male_eligibility_required: '추천 코드 또는 기관 이메일 확인이 필요해요.',
  invalid_signup_method: '가입 방법을 다시 선택해 주세요.',
};

export function eligibilityErrorMessage(error: unknown, fallback = '가입 조건을 확인하지 못했어요. 다시 시도해 주세요.') {
  const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : '';
  return safeSignupMessages[message] || fallback;
}

export async function completeSignup(input: {
  realName: string;
  birthDate: string;
  gender: 'female' | 'male';
  method?: 'female_direct' | MaleSignupMethod;
  referralCode?: string;
}) {
  const { data, error } = await getSupabaseClient().rpc('complete_signup', {
    p_real_name: input.realName.trim(),
    p_birth_date: input.birthDate,
    p_gender: input.gender,
    p_method: input.method ?? null,
    p_referral_code: input.referralCode ? normalizeReferralCode(input.referralCode) : null,
  });
  if (error) throw error;
  const profile = (Array.isArray(data) ? data[0] : data) as SignupProfile | null;
  if (!profile) throw new Error(`missing_${PROFILE_COLUMNS}`);
  return profile;
}

export async function testInstitutionalEmail(action: 'request' | 'verify', email: string, code?: string) {
  const { data, error } = await getSupabaseClient().functions.invoke('test-institutional-email-auth', {
    body: { action, email: normalizeInstitutionalEmail(email), code },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const body = await context.clone().json().catch(() => null);
      if (typeof body?.message === 'string') throw new Error(body.message);
    }
    throw error;
  }
  return data as { verified?: boolean; message: string; expires_in_seconds?: number };
}

export async function getMyReferralCode() {
  const { data, error } = await getSupabaseClient().rpc('get_or_create_my_referral_code');
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('추천 코드를 확인하지 못했어요.');
  return data;
}
