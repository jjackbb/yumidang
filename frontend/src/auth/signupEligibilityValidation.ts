export const TEST_INSTITUTIONAL_EMAIL_CODE = '246810';
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com',
  'yahoo.com', 'yahoo.co.kr', 'hotmail.com', 'outlook.com', 'icloud.com',
]);

export type MaleSignupMethod = 'female_referral' | 'institutional_email';

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

export function validateReferralCode(value: string) {
  return /^YMD-[A-Z0-9]{8}$/.test(normalizeReferralCode(value))
    ? null
    : '유효한 여성 회원 추천 코드를 입력해 주세요.';
}

export function normalizeInstitutionalEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateInstitutionalEmail(value: string) {
  const email = normalizeInstitutionalEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '기관 이메일 형식을 확인해 주세요.';
  if (FREE_EMAIL_DOMAINS.has(email.split('@')[1])) return '개인 무료 이메일은 사용할 수 없어요. 학교나 직장 이메일을 입력해 주세요.';
  return null;
}
