// Pure display helpers for the live app (unit tested).
import type { Post, RequestStatus } from './api.ts';

const seoul = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...options });

export function formatDateTime(iso: string) {
  return seoul({ month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function formatRange(startIso: string, endIso: string) {
  const time = seoul({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = seoul({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const start = new Date(startIso), end = new Date(endIso);
  return day.format(start) === day.format(end)
    ? `${formatDateTime(startIso)} ~ ${time.format(end)}`
    : `${formatDateTime(startIso)} ~ ${formatDateTime(endIso)}`;
}

export const ageLabel = (age: number | null | undefined) => (typeof age === 'number' ? `${age}살` : '나이 비공개');

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '매칭 대화 중',
  withdrawn: '신청 취소',
  declined: '신청 거절',
  matched: '동행 확정',
  not_selected: '다른 동행자와 확정',
};

/** Public post state judged with the server clock returned by the API. */
export function postStatusLabel(post: Pick<Post, 'status' | 'recruitment_ends_at' | 'starts_at'>, serverNow: string | Date) {
  const now = new Date(serverNow).getTime();
  if (post.status === 'closed') return '모집 완료';
  if (post.status === 'expired') return '모집 마감';
  if (post.status === 'recruiting' && (Date.parse(post.recruitment_ends_at) <= now || Date.parse(post.starts_at) <= now)) return '모집 마감';
  return '모집 중';
}

export const PUBLIC_AREA_PATTERN = /^[가-힣]+(특별시|광역시|특별자치시|특별자치도|도) [가-힣]+(시|군|구)( [가-힣]+구)? [가-힣0-9]+(동|읍|면|가)$/;

export function validatePostDraft(draft: {
  title: string; description: string; category: string; startsAt: string | null; endsAt: string | null; recruitmentEndsAt: string | null;
  publicArea: string; exactLocation: string; preferenceNote: string;
}, now = new Date()): string | null {
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 80) return '제목은 2~80자로 입력해 주세요.';
  if (!draft.description.trim() || draft.description.trim().length > 2000) return '설명은 1~2,000자로 입력해 주세요.';
  if (!draft.category) return '카테고리를 선택해 주세요.';
  if (!draft.startsAt || !draft.endsAt || !draft.recruitmentEndsAt) return '일정을 모두 입력해 주세요.';
  if (Date.parse(draft.startsAt) >= Date.parse(draft.endsAt)) return '종료 시각은 시작 시각보다 늦어야 해요.';
  if (Date.parse(draft.recruitmentEndsAt) > Date.parse(draft.startsAt)) return '모집 마감은 시작 시각 이전이어야 해요.';
  if (Date.parse(draft.recruitmentEndsAt) <= now.getTime()) return '모집 마감 시각은 지금 이후여야 해요.';
  if (!PUBLIC_AREA_PATTERN.test(draft.publicArea.trim())) return '공개 위치는 "서울특별시 성동구 성수동"처럼 시·구·동까지만 입력해 주세요.';
  const exact = draft.exactLocation.trim();
  if (exact.length < 2 || exact.length > 200) return '정확한 만남 장소를 2~200자로 입력해 주세요.';
  if (draft.preferenceNote.trim().length > 300) return '선호 조건은 300자 이하로 입력해 주세요.';
  return null;
}

/** Newest-first pages become one oldest-first list without duplicates. */
export function mergeMessages<T extends { id: string; created_at: string }>(current: T[], incoming: T[]) {
  const byId = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => timeKey(a.created_at) - timeKey(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Microsecond-precision sort key; REST and Realtime may format the same timestamp differently. */
export function timeKey(value: string) {
  const micros = /\.(\d{1,6})/.exec(value)?.[1]?.padEnd(6, '0') || '000000';
  const normalized = value.replace(' ', 'T').replace(/\.\d+/, '').replace(/([+-]\d{2})$/, '$1:00');
  const seconds = Math.floor(Date.parse(normalized) / 1000);
  return seconds * 1_000_000 + Number(micros);
}
