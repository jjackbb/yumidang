// Maps Supabase/RPC errors to safe Korean messages (pure; unit tested).
export class LiveApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'LiveApiError'; this.code = code; }
}

const MESSAGES: Record<string, string> = {
  login_required: '로그인이 필요해요.',
  profile_required: '기본 프로필을 먼저 저장해 주세요.',
  profile_unavailable: '프로필을 볼 수 없어요. 공고가 삭제됐거나 존재하지 않아요.',
  post_unavailable: '공고를 찾을 수 없어요.',
  own_post: '내가 작성한 공고에는 참여 요청할 수 없어요.',
  partner_condition_mismatch: '작성자가 정한 상대 성별 조건과 내 프로필 성별이 달라 신청할 수 없어요.',
  recruitment_closed: '모집이 마감된 공고예요.',
  recruitment_must_end_in_future: '모집 마감 시각은 지금 이후여야 해요.',
  invalid_message: '소개 메시지는 공백을 제외하고 10~300자로 입력해 주세요.',
  invalid_input: '입력 내용을 다시 확인해 주세요.',
  request_unavailable: '요청을 찾을 수 없거나 권한이 없어요.',
  invalid_transition: '이미 상태가 바뀐 요청이에요. 새로고침해 확인해 주세요.',
  already_matched: '이미 다른 신청자와 동행이 확정됐어요.',
  request_not_pending: '매칭 대화 중인 요청만 확정할 수 있어요.',
  match_window_closed: '동행 시작 시각이 지나 확정할 수 없어요.',
  exact_location_required: '정확한 만남 장소가 없어 확정할 수 없어요.',
  appointment_unavailable: '동행 정보를 볼 수 없어요.',
  too_early: '동행 종료 시각이 지난 뒤에 완료를 확인할 수 있어요.',
  completion_required: '내 동행 완료를 먼저 확인해 주세요.',
  invalid_rating: '별점은 1~5점 중에서 골라 주세요.',
  invalid_comment: '한마디는 300자 이하로 입력해 주세요.',
  already_submitted: '이미 제출한 평가는 바꿀 수 없어요.',
  review_deadline_passed: '평가 작성 기간이 종료됐어요.',
};

const CONSTRAINT_MESSAGES: Array<[RegExp, string]> = [
  [/posts_public_area_format/, '공개 위치는 "서울특별시 성동구 성수동"처럼 시·구·동까지만 입력해 주세요.'],
  [/post_private_details_location_length/, '정확한 만남 장소를 2~200자로 입력해 주세요.'],
  [/posts_schedule_order/, '모집 마감 ≤ 시작 < 종료 순서로 일정을 입력해 주세요.'],
  [/posts_title_trimmed/, '제목은 2~80자로 입력해 주세요.'],
  [/posts_description_length/, '설명은 1~2,000자로 입력해 주세요.'],
  [/posts_preference_note_length/, '선호 조건은 300자 이하로 입력해 주세요.'],
  [/chat_messages_content_length/, '메시지는 1~1,000자로 입력해 주세요.'],
];

/** Converts Supabase errors to user text without echoing server internals. */
export function toLiveError(error: { message?: string; code?: string } | null | undefined): LiveApiError {
  const raw = error?.message || '';
  if (MESSAGES[raw]) return new LiveApiError(raw, MESSAGES[raw]);
  const constraint = CONSTRAINT_MESSAGES.find(([pattern]) => pattern.test(raw));
  if (constraint) return new LiveApiError('constraint', constraint[1]);
  if (error?.code === '42501') return new LiveApiError('forbidden', '권한이 없어요. 로그인 상태를 확인해 주세요.');
  if (/failed to fetch|network/i.test(raw)) return new LiveApiError('network', 'Supabase에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  return new LiveApiError(error?.code || 'unknown', `요청을 처리하지 못했어요. 다시 시도해 주세요.${error?.code ? ` (오류: ${error.code})` : ''}`);
}
