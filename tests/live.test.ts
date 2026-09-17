import test from 'node:test';
import assert from 'node:assert/strict';

import { toLiveError } from '../src/live/errors.ts';

test('server errors map to safe user messages', () => {
  assert.match(toLiveError({ message: 'partner_condition_mismatch' }).message, /성별/);
  assert.equal(toLiveError({ message: 'too_early' }).code, 'too_early');
  assert.match(toLiveError({ message: 'new row violates check constraint "posts_public_area_format"', code: '23514' }).message, /시·구·동/);
  assert.doesNotMatch(toLiveError({ message: 'internal detail secret', code: 'XX000' }).message, /secret/);
});

test('existing-screen adapters map server rows without inventing sample data', async () => {
  const { toMeetupPost, toJoinRequest, toAppointmentReviews, toNotification, REQUEST_STATUS_TO_SCREEN } = await import('../src/live/adapters.ts');
  const row = { id: 'p1', author_id: 'a', title: 't', description: 'd', category: '전시', starts_at: '2026-09-20T05:00:00Z', ends_at: '2026-09-20T06:00:00Z',
    recruitment_ends_at: '2026-09-20T04:00:00Z', public_area: '서울특별시 성동구 성수동', preference_note: null, tags: ['x'], status: 'recruiting' as const, partner_gender: 'female' as const };
  const anonymousCard = toMeetupPost(row, undefined, undefined, false);
  assert.equal(anonymousCard.author, '작성자');
  assert.equal(anonymousCard.secretLocation, undefined);
  assert.equal(anonymousCard.publicLocation, '');
  assert.equal(anonymousCard.partnerGender, 'female');
  const closed = toMeetupPost({ ...row, status: 'closed' }, { post_id: 'p1', author_id: 'a', masked_name: '가*림', avatar_url: null, gender: 'female', age: 29 }, '성수역 3번 출구', true);
  assert.equal(closed.currentMembers, 2);
  assert.equal(closed.secretLocation, '성수역 3번 출구');
  assert.deepEqual([closed.authorGender, closed.authorAge], ['female', 29]);
  assert.deepEqual(REQUEST_STATUS_TO_SCREEN, { pending: 'pending', withdrawn: 'cancelled', declined: 'rejected', matched: 'accepted', not_selected: 'matched_with_other' });
  const request = toJoinRequest({ id: 'r1', post_id: 'p1', requester_id: 'b', message: 'hello there!', status: 'matched', created_at: 'c', updated_at: 'u' }, closed, { name: '하*비', avatar: '' });
  assert.equal(request.hostId, 'a');
  assert.equal(request.status, 'accepted');
  assert.equal(request.requesterSugar, null, 'missing server sugar is not replaced with a made-up number');
  const notification = toNotification({ id: 'n1', recipient_id: 'a', kind: 'join_request', join_request_id: 'r1', created_at: '2026-09-17T10:00:00Z', read_at: null }, request);
  assert.equal(notification.read, false);
  assert.equal(notification.roomId, 'room-r1');
  assert.match(notification.description, /t/);
  const baseReviewState = { appointment_id: 'ap', appointment_completed: true, deadline_at: 'd', hold_until: 'h', disputed: false, can_write: true, release_reason: null, server_now: 'n' };
  const hidden = toAppointmentReviews({ ...baseReviewState, peer_submitted: true, released: false, own_review: null, peer_review: { rating: 5, comment: '비밀', submitted_at: 's' } }, 'b', 'a');
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].rating, 0);
  assert.equal(hidden[0].comment, '');
  const released = toAppointmentReviews({ ...baseReviewState, peer_submitted: true, released: true, release_reason: 'mutual', own_review: { rating: 4, comment: null, submitted_at: 's' }, peer_review: { rating: 5, comment: '공개', submitted_at: 's' } }, 'b', 'a');
  assert.equal(released.find(item => item.reviewerId === 'a')?.comment, '공개');
});

test('service-mode post form accepts only 시·구·동 public areas and requires the private place', async () => {
  const { defaultPostForm, validatePostForm } = await import('../src/utils/postForm.ts');
  const now = new Date('2026-09-16T03:00:00Z');
  const form = { ...defaultPostForm(now, '전시', true), title: '전시', description: '설명' };
  assert.equal(form.publicLocation, '');
  assert.deepEqual(validatePostForm(form, now, undefined, { serviceMode: true }), {});
  assert.ok(validatePostForm({ ...form, location: '서울 강남구 대치역 3번 출구' }, now, undefined, { serviceMode: true }).location);
  assert.ok(validatePostForm({ ...form, secretLocation: '' }, now, undefined, { serviceMode: true }).secretLocation);
  assert.ok(validatePostForm({ ...form, publicLocation: '' }, now).publicLocation, 'demo form still requires the landmark');
});
