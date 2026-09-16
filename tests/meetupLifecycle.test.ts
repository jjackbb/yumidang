import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completionAvailability, formatMeetupRange, isValidMeetupRange } from '../src/utils/meetupLifecycle.ts';
import type { Appointment } from '../src/types.ts';

const appointment = {
  id: 'walk', status: '매칭 확정', participantIds: ['host', 'guest'],
  scheduledAt: '2026-09-15T14:00:00+09:00', endsAt: '2026-09-15T15:00:00+09:00',
} as Appointment;

test('14:00–15:00 walk stays locked at 14:50 and 14:59:59.999, opens exactly at 15:00', () => {
  for (const time of ['14:00:00', '14:50:00', '14:59:59.999']) {
    assert.equal(completionAvailability(appointment, 'guest', new Date(`2026-09-15T${time}+09:00`)).canComplete, false);
  }
  const atEnd = completionAvailability(appointment, 'guest', new Date(appointment.endsAt!));
  assert.equal(atEnd.canComplete, true);
  assert.equal(atEnd.canReview, false);
});
test('review requires completion and still cannot bypass the end time', () => {
  const completed = { ...appointment, status: '동행 완료' };
  assert.equal(completionAvailability(completed, 'host', new Date('2026-09-15T14:59:00+09:00')).canReview, false);
  assert.equal(completionAvailability(completed, 'host', new Date(appointment.endsAt!)).canReview, true);
  assert.equal(completionAvailability(completed, 'host', new Date(appointment.endsAt!)).canComplete, false);
});
test('missing, invalid and reversed end times fail closed without using recruitment closure', () => {
  for (const endsAt of [undefined, 'invalid', appointment.scheduledAt, '2026-09-15T13:00:00+09:00']) {
    assert.equal(completionAvailability({ ...appointment, endsAt }, 'guest', new Date('2026-09-16')).canComplete, false);
  }
});
test('only participants of a confirmed appointment can complete it', () => {
  const now = new Date('2026-09-16');
  for (const id of [undefined, 'unrelated-user']) assert.equal(completionAvailability(appointment, id, now).canComplete, false);
  for (const status of ['취소', '모집 마감', 'recruiting']) assert.equal(completionAvailability({ ...appointment, status }, 'guest', now).canComplete, false);
});
test('overnight and edited end times use the full date and Korean timezone', () => {
  const overnight = { ...appointment, scheduledAt: '2026-09-15T23:00:00+09:00', endsAt: '2026-09-16T00:30:00+09:00' };
  assert.equal(completionAvailability(overnight, 'host', new Date('2026-09-15T15:29:59Z')).canComplete, false);
  assert.equal(completionAvailability(overnight, 'host', new Date('2026-09-15T15:30:00Z')).canComplete, true);
  assert.equal(completionAvailability({ ...appointment, endsAt: '2026-09-15T16:00:00+09:00' }, 'host', new Date(appointment.endsAt!)).canComplete, false);
});
test('forms reject a zero duration and date ranges display the end date when needed', () => {
  assert.equal(isValidMeetupRange(appointment.scheduledAt, appointment.scheduledAt), false);
  assert.equal(isValidMeetupRange(appointment.scheduledAt, appointment.endsAt), true);
  assert.match(formatMeetupRange(appointment.scheduledAt, appointment.endsAt), /~ 15:00$/);
  assert.match(formatMeetupRange('2026-09-15T23:00:00+09:00', '2026-09-16T01:00:00+09:00'), /~ 2026\. 9\. 16\./);
});
