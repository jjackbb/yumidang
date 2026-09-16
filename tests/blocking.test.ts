import test from 'node:test';
import assert from 'node:assert/strict';
import type { Appointment, CompletionConfirmation } from '../src/types.ts';
import { blockImpact } from '../src/utils/blocking.ts';

const appointment = (id: string): Appointment => ({ id, participantIds: ['a', 'b'], status: '매칭 확정', dDay: '', appointmentBadge: '', title: id, dateTime: '', location: '', partnerName: '', partnerAvatar: '', partnerRating: 0, partnerBio: '', menuRecommendation: '', addressDetail: '', confirmedGuests: 2, totalGuests: 2 });
const completion = (appointmentId: string, userId: string): CompletionConfirmation => ({ appointmentId, userId, confirmedAt: '2026-09-15T15:00:00+09:00' });

test('a normal block may cancel its one ongoing confirmed meetup', () => {
  const result = blockImpact([appointment('one')], [], 'a', 'b');
  assert.equal(result.mode, 'proceed');
  assert.deepEqual(result.appointments.map(item => item.id), ['one']);
});

test('E2 one-sided completion holds block and cancellation without changing records', () => {
  const result = blockImpact([appointment('one')], [completion('one', 'a')], 'a', 'b');
  assert.equal(result.mode, 'hold');
  if (result.mode === 'hold') assert.equal(result.code, 'E2');
});

test('E3 multiple future confirmed meetups holds block and bulk cancellation', () => {
  const result = blockImpact([appointment('one'), appointment('two')], [], 'a', 'b');
  assert.equal(result.mode, 'hold');
  if (result.mode === 'hold') assert.equal(result.code, 'E3');
});

test('completed and cancelled history is preserved and excluded from block cancellations', () => {
  const result = blockImpact([{ ...appointment('done'), status: '동행 완료' }, { ...appointment('cancelled'), status: '동행 취소' }], [], 'a', 'b');
  assert.equal(result.mode, 'proceed');
  assert.equal(result.appointments.length, 0);
});

