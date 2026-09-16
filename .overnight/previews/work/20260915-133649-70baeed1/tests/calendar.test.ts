import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentStart, eventsStartingInWeek, eventStatus, upcomingReminders, weekOfMonth, weeksInMonth } from '../src/utils/calendar.ts';
import type { Appointment, EventBannerItem } from '../src/types.ts';

const event = (startsOn: string, endsOn: string) => ({ id: startsOn, startsOn, endsOn } as EventBannerItem);
const appointment = (id: string, scheduledAt: string, status = '매칭 확정') => ({ id, scheduledAt, status } as Appointment);
const now = new Date('2026-09-14T12:00:00+09:00');

test('weeks use 1–7, 8–14 boundaries including short February and fifth weeks', () => {
  assert.deepEqual([1, 7, 8, 14, 15, 28, 29, 31].map(weekOfMonth), [1, 1, 2, 2, 3, 4, 5, 5]);
  assert.equal(weeksInMonth(2026, 2), 4);
  assert.equal(weeksInMonth(2028, 2), 5);
});
test('week filters use event start dates; previous-week ongoing and ended records remain findable', () => {
  const records = [event('2026-09-01', '2026-09-30'), event('2026-09-03', '2026-09-04'), event('2026-09-08', '2026-09-20'), event('2026-08-08', '2026-09-20')];
  assert.deepEqual(eventsStartingInWeek(records, 2026, 9, 1).map(e => e.id), ['2026-09-01', '2026-09-03']);
  assert.deepEqual(eventsStartingInWeek(records, 2026, 9, 2).map(e => e.id), ['2026-09-08']);
  assert.equal(eventStatus(records[0], now), 'ongoing');
  assert.equal(eventStatus(records[1], now), 'ended');
});
test('event end date is inclusive and transitions at Korean midnight', () => {
  const record = event('2026-09-08', '2026-09-14');
  assert.equal(eventStatus(record, new Date('2026-09-14T14:59:59Z')), 'ongoing');
  assert.equal(eventStatus(record, new Date('2026-09-14T15:00:00Z')), 'ended');
  assert.equal(eventStatus(event('2026-09-15', '2026-09-20'), now), 'upcoming');
});
test('reminders include future D-day and D-7, exclude D-8, passed times, invalid and completed plans, sort by time', () => {
  const records = [appointment('d7', '2026-09-21T20:00:00+09:00'), appointment('d8', '2026-09-22T00:00:00+09:00'), appointment('past', '2026-09-14T11:59:59+09:00'), appointment('today', '2026-09-14T18:00:00+09:00'), appointment('done', '2026-09-16T18:00:00+09:00', '동행 완료'), appointment('invalid', 'invalid')];
  assert.deepEqual(upcomingReminders(records, now).map(r => [r.appointment.id, r.days]), [['today', 0], ['d7', 7]]);
});
test('D-day counts calendar dates in Korea over month boundaries', () => {
  const result = upcomingReminders([appointment('next', '2026-10-07T23:00:00+09:00')], new Date('2026-09-30T14:59:59Z'));
  assert.equal(result[0].days, 7);
});
test('legacy and form schedules parse Korean times without relying on browser locale', () => {
  assert.equal(appointmentStart({ dateTime: '2026.9.21(월) 오후 2:00' }).toISOString(), '2026-09-21T05:00:00.000Z');
  assert.equal(appointmentStart({ dateTime: '2026-09-21 14:00' }).toISOString(), '2026-09-21T05:00:00.000Z');
  assert.ok(Number.isNaN(appointmentStart({ dateTime: '미정' }).getTime()));
});
