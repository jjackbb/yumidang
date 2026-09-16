import test from 'node:test';
import assert from 'node:assert/strict';
import type { Appointment, AppointmentReview, CompletionConfirmation } from '../src/types.ts';
import { completionReviewState, createAppointmentReview, createCompletionConfirmation, releasedReviewsFor, REVIEW_WINDOW_MS } from '../src/utils/reviews.ts';

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

test('own completion immediately opens review without waiting for the other participant', () => {
  const state = completionReviewState(appointment, 'host', [completion('host')], [], end);
  assert.equal(state.ownCompleted, true);
  assert.equal(state.otherCompleted, false);
  assert.equal(state.canReview, true);
});

test('review deadline is open before seven days and closed at the exact boundary', () => {
  const completions = [completion('host')];
  assert.equal(completionReviewState(appointment, 'host', completions, [], new Date(end.getTime() + REVIEW_WINDOW_MS - 1)).canReview, true);
  const atBoundary = completionReviewState(appointment, 'host', completions, [], new Date(end.getTime() + REVIEW_WINDOW_MS));
  assert.equal(atBoundary.canReview, false);
  assert.match(atBoundary.reason, /자동 공개되지 않습니다/);
});

test('review requires a personal completion, valid content and is unique per reviewer', () => {
  const draft = { rating: 5, positiveItems: ['친절해요'], negativeItems: [], comment: '' };
  assert.equal(createAppointmentReview(appointment, 'host', draft, [], [], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', { ...draft, positiveItems: [] }, [completion('host')], [], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', draft, [completion('host')], [review('host', 'guest')], 'A', end).ok, false);
  assert.equal(createAppointmentReview(appointment, 'host', draft, [completion('host')], [], 'A', end).ok, true);
});

test('one review stays private forever and both submissions release only the paired reviews', () => {
  const oneSide = [review('host', 'guest')];
  assert.equal(completionReviewState(appointment, 'host', [completion('host')], oneSide, new Date(end.getTime() + REVIEW_WINDOW_MS * 2)).reviewsReleased, false);
  assert.deepEqual(releasedReviewsFor('guest', oneSide), []);
  const paired = [...oneSide, review('guest', 'host')];
  assert.equal(completionReviewState(appointment, 'host', [completion('host')], paired, end).reviewsReleased, true);
  assert.deepEqual(releasedReviewsFor('guest', paired).map(item => item.id), ['r-host']);
});

