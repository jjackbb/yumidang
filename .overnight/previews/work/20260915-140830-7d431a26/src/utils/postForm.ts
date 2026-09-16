import type { CurrentUser, MeetupPost, PartnerGender } from '../types.ts';
import { koreaDateKey } from './calendar.ts';
import { formatClock, formatMeetupRange } from './meetupLifecycle.ts';

/** One field model for both post forms (04 A one sheet, 04 B two steps). */
export const POST_CATEGORIES = ['지금', '전시', '축제', '식사', '운동', '여행', '클래스', '산책', '스터디', '공연', '쇼핑', '기타'];
export const PARTNER_GENDERS: { value: PartnerGender; label: string }[] = [
  { value: 'any', label: '성별 무관' },
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
];

export interface PostFormValues {
  title: string;
  category: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** Korean `YYYY-MM-DDTHH:mm`; empty means "same as the start time". */
  deadline: string;
  location: string;
  publicLocation: string;
  secretLocation: string;
  partnerGender: PartnerGender;
  partnerPreferences: string;
  tags: string;
}
export type PostFormField = keyof PostFormValues;
export type PostFormErrors = Partial<Record<PostFormField, string>>;

/** 04 B splits the same fields into two steps; validation per step uses the same rules. */
export const POST_FORM_STEPS: PostFormField[][] = [
  ['category', 'title', 'description', 'startDate', 'startTime', 'endDate', 'endTime', 'deadline'],
  ['location', 'publicLocation', 'secretLocation', 'partnerGender', 'partnerPreferences', 'tags'],
];

export const END_BEFORE_START_MESSAGE = '종료 시각은 시작 시각보다 늦어야 해요. 다음 날 끝나면 종료 날짜도 바꿔 주세요.';
export const DEADLINE_MESSAGE = '모집 마감은 현재 시각 이후, 동행 시작 시각 이전으로 정해 주세요. 시작 시각과 같게 설정할 수도 있어요.';

const DAY = 86_400_000;
const koreaMs = (date: string, time: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? Date.parse(`${date}T${time}:00+09:00`) : NaN;
const koreaLocalMs = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? Date.parse(`${value}:00+09:00`) : NaN;
export const koreaLocalInput = (iso: string) => `${koreaDateKey(new Date(iso))}T${formatClock(iso)}`;

export function defaultPostForm(now: Date, category = '식사'): PostFormValues {
  const day = koreaDateKey(new Date(now.getTime() + DAY));
  return {
    title: '', category, description: '',
    startDate: day, startTime: '18:00', endDate: day, endTime: '19:00', deadline: '',
    location: '서울 강남구 대치동', publicLocation: '대치역 3번 출구 앞', secretLocation: '르브런치 2층 예약석',
    partnerGender: 'any', partnerPreferences: '시간 약속 잘 지키고 편안한 대화 나누실 분 환영해요 :)',
    tags: '#맛집탐방 #주말브런치',
  };
}

/** Restores every saved value when editing, in either form variant. */
export function postFormFromPost(post: MeetupPost, now: Date): PostFormValues {
  const base = defaultPostForm(now, post.category);
  const valid = (iso?: string) => Boolean(iso && Number.isFinite(Date.parse(iso)));
  return {
    ...base,
    title: post.title, category: post.category, description: post.description || '',
    startDate: valid(post.startsAt) ? koreaDateKey(new Date(post.startsAt!)) : '',
    startTime: valid(post.startsAt) ? formatClock(post.startsAt!) : '',
    endDate: valid(post.endsAt) ? koreaDateKey(new Date(post.endsAt!)) : '',
    endTime: valid(post.endsAt) ? formatClock(post.endsAt!) : '',
    deadline: valid(post.recruitmentEndsAt) && post.recruitmentEndsAt !== post.startsAt ? koreaLocalInput(post.recruitmentEndsAt!) : '',
    location: post.location, publicLocation: post.publicLocation || '', secretLocation: post.secretLocation || '',
    partnerGender: post.partnerGender || 'any', partnerPreferences: post.partnerPreferences || '',
    tags: post.tags.map(tag => `#${tag}`).join(' '),
  };
}

/** start > now, start < end, now < deadline <= start, and no empty required field. */
export function validatePostForm(values: PostFormValues, now: Date, fields?: PostFormField[]): PostFormErrors {
  const errors: PostFormErrors = {};
  const required = (field: PostFormField, message: string) => { if (!String(values[field]).trim()) errors[field] = message; };
  required('title', '모집 제목을 입력해 주세요.');
  if (!POST_CATEGORIES.includes(values.category)) errors.category = '카테고리를 선택해 주세요.';
  required('description', '동행 상세 소개를 입력해 주세요.');
  const start = koreaMs(values.startDate, values.startTime);
  const end = koreaMs(values.endDate, values.endTime);
  if (!Number.isFinite(start)) errors.startDate = '시작 날짜와 시각을 입력해 주세요.';
  else if (start <= now.getTime()) errors.startDate = '이미 지난 일정이에요. 현재 이후의 시작 시각을 정해 주세요.';
  if (!Number.isFinite(end)) errors.endDate = '종료 날짜와 시각을 입력해 주세요.';
  else if (Number.isFinite(start) && end <= start) errors.endDate = END_BEFORE_START_MESSAGE;
  const deadline = values.deadline ? koreaLocalMs(values.deadline) : start;
  if (values.deadline && !Number.isFinite(deadline)) errors.deadline = '모집 마감 날짜·시각을 확인해 주세요.';
  else if (Number.isFinite(start) && (deadline <= now.getTime() || deadline > start)) errors.deadline = DEADLINE_MESSAGE;
  required('location', '공개 만남 지역을 입력해 주세요.');
  required('publicLocation', '공개 랜드마크를 입력해 주세요.');
  if (!PARTNER_GENDERS.some(option => option.value === values.partnerGender)) errors.partnerGender = '상대 성별 조건을 선택해 주세요.';
  if (!fields) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field as PostFormField))) as PostFormErrors;
}

export const parseTags = (input: string, category: string) => {
  const tags = input.split(/\s+/).map(tag => tag.replace(/^#+/, '').trim()).filter(Boolean);
  return tags.length ? tags : [category, '1대1동행'];
};

/** Saved post fields; identical for A and B. Call only after `validatePostForm` returns no errors. */
export function postFieldsFromForm(values: PostFormValues) {
  const startsAt = new Date(koreaMs(values.startDate, values.startTime)).toISOString();
  const endsAt = new Date(koreaMs(values.endDate, values.endTime)).toISOString();
  const recruitmentEndsAt = values.deadline ? new Date(koreaLocalMs(values.deadline)).toISOString() : startsAt;
  return {
    title: values.title.trim(), category: values.category, description: values.description.trim(),
    startsAt, endsAt, recruitmentEndsAt, time: formatMeetupRange(startsAt, endsAt),
    location: values.location.trim(), publicLocation: values.publicLocation.trim(), secretLocation: values.secretLocation.trim(),
    partnerGender: values.partnerGender, partnerPreferences: values.partnerPreferences.trim(),
    tags: parseTags(values.tags, values.category),
  };
}

/** Members who meet the author's condition can apply; others see why not. */
export function requestEligibility(post: Pick<MeetupPost, 'partnerGender'>, user: Pick<CurrentUser, 'gender'> | null | undefined) {
  const condition = post.partnerGender || 'any';
  if (condition === 'any' || !user || user.gender === condition) return { ok: true, reason: '' };
  const who = condition === 'female' ? '여성' : '남성';
  return { ok: false, reason: `이 공고는 ${who}만 신청할 수 있어요. 작성자가 정한 상대 조건과 내 프로필 성별이 달라요.` };
}
