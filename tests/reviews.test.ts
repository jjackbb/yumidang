import test from 'node:test';
import assert from 'node:assert/strict';
import type { Appointment, AppointmentReview, CompletionConfirmation } from '../src/types.ts';
import { completionReviewState, createAppointmentReview, createCompletionConfirmation, releasedReviewsFor, REVIEW_HOLD_MS, REVIEW_WINDOW_MS } from '../src/utils/reviews.ts';

const appointment: Appointment = {
  id: 'a1', participantIds: ['host', 'guest'], status: '매칭 확정', dDay: '오늘', appointmentBadge: '확정',
  title: '공원 산책', scheduledAt: '2026-09-15T14:00:00+09:00', endsAt: '2026-09-15T15:00:00+09:00',
  dateTime: '', location: '', partnerName: '', partnerAvatar: '', partnerRating: 0, partnerBio: '', menuRecommendation: '', addressDetail: '', confirmedGuests: 2, totalGuests: 2,
};
const end = new Date(appointment.endsAt!);
const completion = (userId: string): CompletionConfirmation => ({ appointmentId: appointment.id, userId, confirmedAt: end.toISOString() });
const review = (reviewerId: string, revieweeId: string): AppointmentReview => ({
  id: `r-${reviewerId}`, appointmentId: appointment.id, reviewerId, revieweeId, rating: 5,
  positiveItems: ['시간 약속'], negativeItems: [], comment: '', submittedAt: end.toISOString(), variant: 'A',
});

test('completion opens at the exact appointment end, never ten minutes early', () => {
  assert.equal(completionReviewState(appointment, 'host', [], [], new Date(end.getTime() - 1)).canComplete, false);
  assert.equal(completionReviewState(appointment, 'host', [], [], end).canComplete, true);
  assert.equal(createCompletionConfirmation(appointment, 'host', [], [], end).ok, true);
});

test('the first completion completes the appointment and opens review for both participants', () => {
  const state = completionReviewState(appointment, 'host', [completion('host')], [], end);
  assert.equal(state.ownCompleted, true);
  assert.equal(state.otherCompleted, false);
  assert.equal(state.appointmentCompleted, true);
  assert.equal(state.canReview, true);
  assert.equal(state.canComplete, false);
  assert.equal(completionReviewState(appointment, 'guest', [completion('host')], [], end).canReview, true);
});

test('review deadline is open before seven days and closed at the exact boundary', () => {
  const completions = [completion('host')];
  assert.equal(completionReviewState(appointment, 'host', completions, [], new Date(end.getTime() + REVIEW_WINDOW_MS - 1)).canReview, true);
  const atBoundary = completionReviewState(appointment, 'host', completions, [], new Date(end.getTime() + REVIEW_WINDOW_MS));
  assert.equal(atBoundary.canReview, false);
  assert.match(atBoundary.reason, /기간이 끝났어요/);
});

test('review requires appointment completion, valid content and is unique per reviewer', () => {
  const draft = { rating: 5, positiveItems: ['친절해요'], negativeItems: [], comment: '' };
  assert.equal(createAppointmentReview(appointment, 'host', draft, [], [], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', { ...draft, positiveItems: [] }, [completion('host')], [], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', draft, [completion('host')], [review('host', 'guest')], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', draft, [completion('host')], [], 'A', end).ok, true);
});

test('reviews stay hidden for 24 hours, then mutual or deadline release applies', () => {
  const oneSide = [review('host', 'guest')];
  assert.equal(completionReviewState(appointment, 'host', [completion('host')], oneSide, new Date(end.getTime() + REVIEW_HOLD_MS)).reviewsReleased, false);
  const deadlineState = completionReviewState(appointment, 'host', [completion('host')], oneSide, new Date(end.getTime() + REVIEW_WINDOW_MS));
  assert.equal(deadlineState.reviewsReleased, true);
  assert.equal(deadlineState.releaseReason, 'deadline');
  const paired = [...oneSide, review('guest', 'host')];
  const pairedOnHold = completionReviewState(appointment, 'host', [completion('host')], paired, new Date(end.getTime() + REVIEW_HOLD_MS - 1));
  assert.equal(pairedOnHold.reviewsReleased, false);
  assert.equal(pairedOnHold.hasOtherReview, true);
  assert.match(pairedOnHold.reason, /양쪽 평가가 모두 제출/);
  assert.doesNotMatch(pairedOnHold.reason, /상대 평가.*도착하면/);
  assert.equal(completionReviewState(appointment, 'host', [completion('host')], paired, new Date(end.getTime() + REVIEW_HOLD_MS)).reviewsReleased, true);
  assert.deepEqual(releasedReviewsFor('guest', oneSide), []);
  assert.deepEqual(releasedReviewsFor('guest', paired).map(item => item.id), ['r-host']);
});

test('server policy snapshot overrides browser clock and freezes disputed reviews', () => {
  const liveAppointment: Appointment = {
    ...appointment,
    status: '이의 검토 중',
    livePolicy: {
      completionMethod: 'automatic', completionNotifiedAt: end.toISOString(), disputeDeadlineAt: new Date(end.getTime() + REVIEW_HOLD_MS).toISOString(),
      completedByMe: false, canComplete: false, canDispute: false, disputeStatus: 'open',
      reviewDeadlineAt: new Date(end.getTime() + REVIEW_WINDOW_MS).toISOString(), reviewHoldUntil: new Date(end.getTime() + REVIEW_HOLD_MS).toISOString(),
      reviewDisputed: true, reviewCanWrite: false, reviewsReleased: false, reviewReleaseReason: null,
    },
  };
  const state = completionReviewState(liveAppointment, 'host', [], [], new Date('2099-01-01'));
  assert.equal(state.disputed, true);
  assert.equal(state.canReview, false);
  assert.match(state.reason, /멈춰요/);
});
