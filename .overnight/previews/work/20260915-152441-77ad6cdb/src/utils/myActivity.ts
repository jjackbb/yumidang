import type { Appointment, JoinRequest, MeetupPost } from '../types.ts';
import { isConfirmedAppointment } from './postLifecycle.ts';

/** Written posts are always listed above these tabs, so Me opens on confirmed meetups. */
export type ActivityTab = 'confirmed' | 'completed' | 'cancelled';
export const ACTIVITY_TABS: { id: ActivityTab; label: string }[] = [
  { id: 'confirmed', label: '확정' },
  { id: 'completed', label: '완료' },
  { id: 'cancelled', label: '취소' },
];

/** Me status lists read the same shared records every other screen uses. */
export function myActivity(userId: string, posts: MeetupPost[], appointments: Appointment[]) {
  const mine = appointments.filter(item => item.participantIds?.includes(userId));
  return {
    posts: posts.filter(post => post.authorId === userId),
    confirmed: mine.filter(isConfirmedAppointment),
    completed: mine.filter(item => item.status === '동행 완료'),
    cancelled: mine.filter(item => item.status === '동행 취소'),
  };
}

/** Why a post no longer takes requests. Closing recruitment is not a completed meetup. */
export function postEndedReason(post: MeetupPost): string | null {
  if (post.status === 'deleted') return '삭제한 공고예요. 새 신청은 받을 수 없고 이전 신청·대화 기록은 남아 있어요.';
  if (post.status === 'expired') return '모집 마감 시각이 지나 새 신청을 받지 않아요.';
  if (post.status !== 'closed') return null;
  if (post.closedReason === 'matched') return '1명과 확정돼 모집이 끝났어요. 동행 완료는 종료 시각 이후 각자 확인해요.';
  if (post.closedReason === 'cancelled') return '확정된 동행이 취소돼 모집이 종료됐어요.';
  return '모집을 마감했어요. 동행이 확정되거나 완료된 것은 아니에요.';
}

export const requestEndedReason: Partial<Record<JoinRequest['status'], string>> = {
  rejected: '작성자가 신청을 거절했어요.',
  cancelled: '신청을 취소했어요. 이전 대화는 읽을 수 있어요.',
  matched_with_other: '작성자가 다른 신청자와 1:1로 확정해 이 신청은 종료됐어요.',
  post_closed: '작성자가 모집을 마감해 확정되지 않은 신청이 종료됐어요.',
  post_expired: '모집 마감 시각이 지나 신청이 종료됐어요.',
  post_deleted: '작성자가 공고를 삭제해 신청이 종료됐어요. 대화 기록은 남아 있어요.',
  change_declined: '변경된 공고 조건에 동의하지 않아 신청이 종료됐어요.',
  match_cancelled: '확정됐던 동행이 취소됐어요.',
};
