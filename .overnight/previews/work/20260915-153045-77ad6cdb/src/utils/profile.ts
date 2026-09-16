import type { CurrentUser } from '../types.ts';
import { OVERSIZED_IMAGE } from './prototypeStore.ts';

// Signup and profile rules shared by the signup modal, the profile editor and tests.
// These are front-end checks for the prototype, not a server filter.

export const PHONE_MAX_DIGITS = 11;
export const BIO_MAX_CHARS = 300;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const MIN_SIGNUP_AGE = 19;
export const MAX_HOBBIES = 5;
export const MAX_TRAITS = 3;

export const HOBBY_OPTIONS = ['전시', '공연', '축제', '카페', '디저트', '맛집', '브런치', '산책', '러닝', '운동', '사진', '공예', '원데이 클래스', '독서', '여행', '반려견'];
export const TRAIT_OPTIONS = ['차분한', '활발한', '배려하는', '시간을 잘 지키는', '이야기를 잘 듣는', '계획적인', '느긋한', '꼼꼼한'];
export const NEIGHBORHOOD_OPTIONS = ['성동구 성수동', '종로구 삼청동', '강남구 삼성동', '강남구 역삼동', '마포구 연남동', '영등포구 여의도동', '송파구 잠실동'];

/** Digits only, at most 11 — the same for typing and pasting. */
export const sanitizePhone = (input: string) => input.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);

export function validatePhone(phone: string): string | null {
  if (!phone) return '휴대폰 번호를 입력해 주세요.';
  if (!/^01\d{9}$/.test(phone)) return '휴대폰 번호 11자리를 01로 시작하게 입력해 주세요.';
  return null;
}

const JAMO = /[ㄱ-ㅎㅏ-ㅣ]/;

/** Checked on next/save only, so IME composition is never interrupted while typing. */
export function validateKoreanName(value: string): string | null {
  const name = value.trim();
  if (!name) return '실명을 입력해 주세요.';
  if (JAMO.test(name)) return '자음·모음 낱자(ㄱ~ㅎ, ㅏ~ㅣ)가 있어요. 완성된 한글 음절로 입력해 주세요.';
  if (/[^가-힣]/.test(name)) return '실명은 공백·영문·숫자·기호 없이 한글로만 입력해 주세요.';
  if (name.length < 2 || name.length > 10) return '실명은 한글 2~10자로 입력해 주세요.';
  return null;
}

/** Calendar date in Asia/Seoul as YYYY-MM-DD. */
export function koreaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function parseBirthDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Full years on the Korean calendar date of `now`. */
export function ageOn(birthDate: string, now = new Date()) {
  const birth = parseBirthDate(birthDate);
  const today = parseBirthDate(koreaToday(now));
  if (!birth || !today) return null;
  const hadBirthday = today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (hadBirthday ? 0 : 1);
}

export function validateBirthDate(value: string, now = new Date()): string | null {
  if (!value) return '생년월일을 입력해 주세요.';
  const birth = parseBirthDate(value);
  if (!birth || birth.year < 1900) return '올바른 생년월일을 입력해 주세요. (예: 1998-04-12)';
  if (value > koreaToday(now)) return '미래 날짜는 생년월일로 입력할 수 없어요.';
  if ((ageOn(value, now) ?? 0) < MIN_SIGNUP_AGE) return `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있어요.`;
  return null;
}

/** Public profiles show only this band, never the original birth date. */
export function ageGroupOf(birthDate: string | undefined, now = new Date()) {
  const age = birthDate ? ageOn(birthDate, now) : null;
  if (age === null) return '';
  if (age >= 50) return '50대 이상';
  return `${Math.floor(age / 10) * 10}대`;
}

const FREE_MAIL = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

export function validateReferralCode(code: string): string | null {
  const value = code.trim();
  if (!value) return '추천인 코드를 입력해 주세요.';
  if (!/^[A-Z0-9-]{4,12}$/.test(value)) return '추천인 코드는 영문 대문자·숫자·하이픈 4~12자예요.';
  return null;
}

export function validateWorkEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!value) return '학교 또는 직장 이메일을 입력해 주세요.';
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value)) return '이메일 형식을 확인해 주세요.';
  if (FREE_MAIL.includes(value.split('@')[1])) return '개인 메일이 아닌 학교·직장 이메일을 입력해 주세요.';
  return null;
}

export interface PhotoFileInfo { name: string; type: string; size: number }

export function validatePhotoFile(file: PhotoFileInfo): string | null {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  const typeOk = ['image/jpeg', 'image/png'].includes(file.type) || (!file.type && ['jpg', 'jpeg', 'png'].includes(extension));
  if (!typeOk || !['jpg', 'jpeg', 'png'].includes(extension)) return 'JPG, JPEG, PNG 사진만 등록할 수 있어요.';
  if (file.size > PHOTO_MAX_BYTES) return '사진은 10MB 이하만 등록할 수 있어요.';
  if (file.size === 0) return '빈 파일이에요. 다른 사진을 선택해 주세요.';
  return null;
}

const CONTACT_PATTERNS: RegExp[] = [
  /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /(카톡|카카오톡|오픈채팅|오픈톡|인스타|insta|텔레그램|telegram|라인\s*아이디)/i,
  /open\.kakao\.com|t\.me\//i,
];
const BANNED_WORDS = ['성매매', '조건만남', '원나잇', '스폰', '용돈 드림', '투자 권유', '다단계', '포교'];

export function validateBio(text: string): string | null {
  const value = text.trim();
  if (!value) return '자기소개를 입력해 주세요.';
  if (text.length > BIO_MAX_CHARS) return `자기소개는 ${BIO_MAX_CHARS}자 이하로 줄여 주세요. (현재 ${text.length}자)`;
  if (CONTACT_PATTERNS.some(pattern => pattern.test(value))) return '연락처·메신저 아이디·이메일은 소개에 적을 수 없어요. 대화는 유미당 채팅을 이용해 주세요.';
  const banned = BANNED_WORDS.find(word => value.includes(word));
  if (banned) return `소개에 사용할 수 없는 표현(‘${banned}’)이 있어요. 수정해 주세요.`;
  return null;
}

export type ProfileStep = 'photo' | 'interests' | 'bio';
export const PROFILE_STEPS: ProfileStep[] = ['photo', 'interests', 'bio'];

/** A stored photo that was stripped for size (or never set) must be registered again. */
export const hasUsablePhoto = (avatar: string | undefined) => Boolean(avatar && avatar !== OVERSIZED_IMAGE);

export function missingProfileSteps(user: Pick<CurrentUser, 'avatar' | 'hobbies' | 'traits' | 'bio'>): ProfileStep[] {
  const missing: ProfileStep[] = [];
  if (!hasUsablePhoto(user.avatar)) missing.push('photo');
  if (!user.hobbies?.length || !user.traits?.length) missing.push('interests');
  if (validateBio(user.bio || '')) missing.push('bio');
  return missing;
}

export const isProfileComplete = (user: Pick<CurrentUser, 'avatar' | 'hobbies' | 'traits' | 'bio'>) => missingProfileSteps(user).length === 0;

export const profileStepLabel: Record<ProfileStep, string> = { photo: '사진', interests: '취미·성향', bio: '소개' };

/** Neutral placeholder so an unregistered photo never looks like someone's real picture. */
export const PLACEHOLDER_AVATAR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#ede9fe"/><circle cx="40" cy="31" r="14" fill="#c4b5fd"/><path d="M14 72c3-15 14-23 26-23s23 8 26 23" fill="#c4b5fd"/></svg>')}`;
export const avatarSrc = (avatar: string | undefined) => (hasUsablePhoto(avatar) ? avatar! : PLACEHOLDER_AVATAR);
