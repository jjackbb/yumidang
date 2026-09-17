import type { AuthError, PostgrestError } from '@supabase/supabase-js';

import { ageOn, validateBirthDate, validatePhone } from '../utils/profile.ts';

export const REAL_NAME_MIN_CHARS = 2;
export const REAL_NAME_MAX_CHARS = 20;
export const PROFILE_COLUMNS = 'id,real_name,birth_date,gender,avatar_url,bio,created_at,updated_at';
export interface SignupProfile {
  id: string;
  /** Private source; other members only receive the server-masked name. */
  real_name: string;
  /** Private; used only by the server to check a post's partner gender condition. Null for older accounts. */
  gender: 'female' | 'male' | null;
  birth_date: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export function toE164KoreanPhone(phone: string) {
  const problem = validatePhone(phone);
  if (problem) throw new Error(problem);
  return `+82${phone.slice(1)}`;
}

export function validateRealName(value: string): string | null {
  const name = value.trim();
  if (!name) return '실명을 입력해 주세요.';
  if ([...name].length < REAL_NAME_MIN_CHARS || [...name].length > REAL_NAME_MAX_CHARS)
    return `실명은 ${REAL_NAME_MIN_CHARS}~${REAL_NAME_MAX_CHARS}자로 입력해 주세요.`;
  return null;
}

export function validateSignupProfile(realName: string, birthDate: string, now = new Date(), gender?: 'female' | 'male' | null) {
  return validateRealName(realName) || (gender === null ? '성별을 선택해 주세요.' : null) || validateBirthDate(birthDate, now);
}

export function exactAgeLabel(birthDate: string, now = new Date()) {
  const age = ageOn(birthDate, now);
  return age === null ? '' : `${age}살`;
}

type SupabaseLikeError = Pick<AuthError | PostgrestError, 'message'> & { status?: number; code?: string };

export type AuthMode = 'login' | 'signup';

export function authErrorMessage(error: SupabaseLikeError, action: 'send' | 'verify' | 'profile', mode: AuthMode = 'signup') {
  const haystack = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  if (action === 'send' && mode === 'login' && (haystack.includes('signups not allowed') || haystack.includes('user_not_found')))
    return '가입된 휴대폰 번호가 아니에요. 아래 회원가입 버튼을 눌러 먼저 가입해 주세요.';
  if (error.status === 429 || haystack.includes('rate limit') || haystack.includes('over_sms_send_rate_limit') || haystack.includes('over_request_rate_limit'))
    return '요청이 너무 많아요. 잠시 기다린 뒤 인증번호를 다시 요청해 주세요.';
  if (haystack.includes('expired'))
    return '인증번호가 만료됐어요. 인증번호를 다시 요청해 주세요.';
  if (action === 'verify' && (haystack.includes('invalid') || haystack.includes('token')))
    return '인증번호가 맞지 않아요. 번호를 확인하거나 다시 요청해 주세요.';
  if (action === 'profile' && (error.status === 409 || haystack.includes('duplicate')))
    return '이미 기본 프로필이 저장되어 있어요. 가입 상태를 다시 확인할게요.';
  if (action === 'send' && (haystack.includes('failed to fetch') || haystack.includes('network')))
    return 'Supabase에 연결하지 못했어요. 인터넷 연결을 확인하고 개발 서버를 다시 시작한 뒤 재시도해 주세요.';
  if (action === 'send' && haystack.includes('sms_send_failed'))
    return '문자 인증 공급자 오류로 요청하지 못했어요. 테스트 번호인지 확인해 주세요.';
  if (action === 'send' && (haystack.includes('phone_provider_disabled') || haystack.includes('otp_disabled')))
    return '휴대폰 OTP 인증을 사용할 수 없어요. Supabase Auth 설정을 확인해 주세요.';
  if (action === 'send') {
    const reference = error.code || (error.status ? `HTTP ${error.status}` : 'UNKNOWN');
    return `인증번호 요청에 실패했어요. 잠시 후 다시 시도해 주세요. (오류: ${reference})`;
  }
  if (action === 'verify') return '인증 확인에 실패했어요. 인증번호를 다시 확인해 주세요.';
  return '기본 프로필을 저장하지 못했어요. 입력 내용은 유지되니 다시 시도해 주세요.';
}
