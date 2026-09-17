import type { Appointment, AppointmentReview, CompletionConfirmation } from '../types.ts';
import { formatSchedule } from './calendar.ts';
import { isValidMeetupRange } from './meetupLifecycle.ts';

export const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_HOLD_MS = 24 * 60 * 60 * 1000;

export interface CompletionReviewState {
  canComplete: boolean;
  canReview: boolean;
  canDispute: boolean;
  appointmentCompleted: boolean;
  disputed: boolean;
  completionMethod?: 'manual' | 'automatic' | null;
  ownCompleted: boolean;
  otherCompleted: boolean;
  hasOwnReview: boolean;
  hasOtherReview: boolean;
  reviewsReleased: boolean;
  releaseReason?: 'mutual' | 'deadline' | null;
  holdUntil?: string;
  partnerId?: string;
  reviewDeadline?: string;
  reason: string;
}

const isEligibleAppointment = (appointment: Appointment) =>
  ['매칭 확정', '매칭완료', '동행 완료'].includes(appointment.status);

const completionFor = (items: CompletionConfirmation[], appointmentId: string, userId: string) =>
  items.find(item => item.appointmentId === appointmentId && item.userId === userId);

const reviewFor = (items: AppointmentReview[], appointmentId: string, reviewerId: string) =>
  items.find(item => item.appointmentId === appointmentId && item.reviewerId === reviewerId);

/**
 * Derives every completion/review permission from personal records.
 * Appointment.status is only a summary and never grants access to a hidden review.
 */
export function completionReviewState(
  appointment: Appointment,
  userId: string | undefined,
  completions: CompletionConfirmation[],
  reviews: AppointmentReview[],
  now = new Date(),
): CompletionReviewState {
  const base = {
    canComplete: false,
    canReview: false,
    canDispute: false,
    appointmentCompleted: false,
    disputed: false,
    ownCompleted: false,
    otherCompleted: false,
    hasOwnReview: false,
    hasOtherReview: false,
    reviewsReleased: false,
  };
  if (!userId) return { ...base, reason: '로그인 후 참여한 동행을 완료할 수 있어요.' };
  if (!appointment.participantIds?.includes(userId)) return { ...base, reason: '이 동행의 참여자만 완료·평가할 수 있어요.' };
  const partnerId = appointment.participantIds.find(id => id !== userId);
  if (!partnerId) return { ...base, reason: '평가할 상대를 확인할 수 없어요.' };

  // Normal mode receives an already-authorized, server-clock-based policy snapshot.
  // Do not recompute its deadlines with the browser clock.
  if (appointment.livePolicy) {
    const policy = appointment.livePolicy;
    const hasOwnReview = Boolean(reviewFor(reviews, appointment.id, userId));
    const hasOtherReview = Boolean(reviewFor(reviews, appointment.id, partnerId));
    const appointmentCompleted = ['동행 완료', '이의 검토 중'].includes(appointment.status);
    const automatic = policy.completionMethod === 'automatic';
    const common = {
      ...base,
      partnerId,
      appointmentCompleted,
      disputed: policy.reviewDisputed,
      completionMethod: policy.completionMethod,
      canComplete: policy.canComplete,
      canDispute: policy.canDispute,
      canReview: policy.reviewCanWrite,
      ownCompleted: appointmentCompleted && (automatic || policy.completedByMe),
      otherCompleted: appointmentCompleted && (automatic || !policy.completedByMe),
      hasOwnReview,
      hasOtherReview,
      reviewsReleased: policy.reviewsReleased,
      releaseReason: policy.reviewReleaseReason,
      reviewDeadline: policy.reviewDeadlineAt || undefined,
      holdUntil: policy.reviewHoldUntil || undefined,
    };
    if (appointment.status === '불발') return { ...common, canReview: false, canDispute: false, reason: '불발 처리된 동행은 평가와 공개 대상에서 제외돼요.' };
    if (appointment.status === '동행 취소') return { ...common, canComplete: false, canReview: false, canDispute: false, reason: '취소된 동행은 완료·평가할 수 없어요. 이전 기록만 확인할 수 있습니다.' };
    if (policy.reviewDisputed) return { ...common, canReview: false, reason: '이의 검토 중에는 평가 작성과 공개 시계가 모두 멈춰요.' };
    if (policy.reviewsReleased) return {
      ...common,
      reason: policy.reviewReleaseReason === 'deadline'
        ? '평가 기한이 끝나 제출된 후기가 공개됐어요.'
        : '양쪽 평가가 모두 제출되어 후기가 공개됐어요.',
    };
    if (!appointmentCompleted) return {
      ...common,
      reason: policy.canComplete ? '동행이 끝났어요. 한 명이 완료하면 동행 전체가 바로 완료돼요.' : '동행 종료 뒤 완료할 수 있어요.',
    };
    if (hasOwnReview) return { ...common, reason: '내 평가는 제출됐어요. 상대 평가가 먼저 도착하면 보류 종료 후, 아니면 평가 기한에 공개돼요.' };
    if (policy.reviewCanWrite) return { ...common, reason: '동행이 완료됐어요. 공개 보류 중에도 평가를 작성할 수 있어요.' };
    return { ...common, reason: '평가 작성 기간이 끝났거나 현재 평가를 작성할 수 없는 상태예요.' };
  }

  if (appointment.status === '동행 취소') return { ...base, reason: '취소된 동행은 완료·평가할 수 없어요. 이전 기록만 확인할 수 있습니다.' };
  if (!isEligibleAppointment(appointment)) return { ...base, reason: '확정된 동행만 완료·평가할 수 있어요.' };
  if (!isValidMeetupRange(appointment.scheduledAt, appointment.endsAt)) return { ...base, reason: '공고의 종료 시각을 먼저 확인해 주세요.' };

  const endMs = Date.parse(appointment.endsAt!);
  const appointmentCompletions = completions.filter(item => item.appointmentId === appointment.id);
  const completedAtMs = appointmentCompletions.length
    ? Math.min(...appointmentCompletions.map(item => Date.parse(item.confirmedAt)))
    : appointment.status === '동행 완료' ? endMs : Number.NaN;
  const appointmentCompleted = Number.isFinite(completedAtMs);
  const reviewDeadlineMs = completedAtMs + REVIEW_WINDOW_MS;
  const holdUntilMs = completedAtMs + REVIEW_HOLD_MS;
  const ownCompleted = Boolean(completionFor(completions, appointment.id, userId));
  const otherCompleted = Boolean(completionFor(completions, appointment.id, partnerId));
  const hasOwnReview = Boolean(reviewFor(reviews, appointment.id, userId));
  const hasOtherReview = Boolean(reviewFor(reviews, appointment.id, partnerId));
  const reviewsReleased = appointmentCompleted && now.getTime() >= holdUntilMs
    && ((hasOwnReview && hasOtherReview) || (now.getTime() >= reviewDeadlineMs && (hasOwnReview || hasOtherReview)));
  const common = {
    ...base,
    partnerId,
    reviewDeadline: appointmentCompleted ? new Date(reviewDeadlineMs).toISOString() : undefined,
    ownCompleted,
    otherCompleted,
    hasOwnReview,
    hasOtherReview,
    reviewsReleased,
    appointmentCompleted,
    completionMethod: appointmentCompleted ? 'manual' as const : null,
    holdUntil: appointmentCompleted ? new Date(holdUntilMs).toISOString() : undefined,
    releaseReason: reviewsReleased ? (hasOwnReview && hasOtherReview ? 'mutual' as const : 'deadline' as const) : null,
  };

  if (now.getTime() < endMs) return { ...common, reason: `${formatSchedule(appointment.endsAt!)}부터 내 완료를 확인할 수 있어요.` };
  if (!appointmentCompleted) return { ...common, canComplete: true, reason: '동행이 끝났어요. 한 명이 완료하면 동행 전체가 바로 완료돼요.' };
  if (hasOwnReview && reviewsReleased) return { ...common, reason: hasOtherReview ? '양쪽 평가가 모두 제출되어 후기가 공개됐어요.' : '평가 기한이 끝나 제출된 후기가 공개됐어요.' };
  if (hasOwnReview) return { ...common, reason: '내 평가는 제출됐어요. 상대 평가가 먼저 도착하면 보류 종료 후, 아니면 평가 기한에 공개돼요.' };
  if (now.getTime() >= reviewDeadlineMs) return { ...common, reason: '평가 작성 기간이 끝났어요.' };
  return {
    ...common,
    canReview: true,
    reason: '동행이 완료됐어요. 공개 보류 중에도 평가를 작성할 수 있어요.',
  };
}

export function createCompletionConfirmation(
  appointment: Appointment,
  userId: string,
  completions: CompletionConfirmation[],
  reviews: AppointmentReview[],
  now = new Date(),
): { ok: true; value: CompletionConfirmation } | { ok: false; error: string } {
  const state = completionReviewState(appointment, userId, completions, reviews, now);
  if (!state.canComplete) return { ok: false, error: state.reason };
  return { ok: true, value: { appointmentId: appointment.id, userId, confirmedAt: now.toISOString() } };
}

export interface ReviewDraft {
  rating: number;
  positiveItems: string[];
  negativeItems: string[];
  comment: string;
}

export function createAppointmentReview(
  appointment: Appointment,
  userId: string,
  draft: ReviewDraft,
  completions: CompletionConfirmation[],
  reviews: AppointmentReview[],
  variant: AppointmentReview['variant'],
  now = new Date(),
): { ok: true; value: AppointmentReview } | { ok: false; error: string } {
  const state = completionReviewState(appointment, userId, completions, reviews, now);
  if (!state.canReview || !state.partnerId) return { ok: false, error: state.reason };
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) return { ok: false, error: '별점을 1점부터 5점 사이에서 선택해 주세요.' };
  const positiveItems = [...new Set(draft.positiveItems.map(item => item.trim()).filter(Boolean))];
  const negativeItems = [...new Set(draft.negativeItems.map(item => item.trim()).filter(Boolean))];
  if (!positiveItems.length && !negativeItems.length) return { ok: false, error: '좋았던 점이나 아쉬웠던 점을 하나 이상 선택해 주세요.' };
  const comment = draft.comment.trim();
  if (comment.length > 300) return { ok: false, error: '한마디는 300자 이하로 적어 주세요.' };
  return {
    ok: true,
    value: {
      id: `appointment-review-${appointment.id}-${userId}`,
      appointmentId: appointment.id,
      reviewerId: userId,
      revieweeId: state.partnerId,
      rating: draft.rating,
      positiveItems,
      negativeItems,
      comment,
      submittedAt: now.toISOString(),
      variant,
    },
  };
}

export const releasedReviewsFor = (revieweeId: string, reviews: AppointmentReview[]) => reviews.filter(review => {
  if (review.revieweeId !== revieweeId) return false;
  if (review.released !== undefined) return review.released;
  return reviews.some(other => other.appointmentId === review.appointmentId && other.reviewerId === review.revieweeId && other.revieweeId === review.reviewerId);
});
