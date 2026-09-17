// Manual check: after an operator moves this run-only appointment past review_deadline_at,
// B's late review is refused and A's one-sided review is released.
import assert from 'node:assert/strict';
import { createContext } from '../helpers/runner.mjs';
const appointmentId = process.argv[2];
const ctx = createContext();
const a = await ctx.member('A'); const b = await ctx.member('B');
const late = await b.sdk.rpc('submit_appointment_review', { p_appointment_id: appointmentId, p_rating: 4, p_comment: null });
assert.equal(late.error?.message, 'review_deadline_passed');
const forB = (await b.sdk.rpc('get_appointment_review_state', { p_appointment_id: appointmentId }).single()).data;
const forA = (await a.sdk.rpc('get_appointment_review_state', { p_appointment_id: appointmentId }).single()).data;
assert.equal(forB.can_write, false);
assert.equal(forB.peer_submitted, true);
assert.ok(forB.peer_review);
assert.equal(forB.released, true);
assert.equal(forB.release_reason, 'deadline');
assert.equal(forA.released, true);
assert.equal(forA.release_reason, 'deadline');
assert.equal(forA.peer_review, null);
console.log(JSON.stringify({ result: 'PASS', checks: ['late submit refused after completed_at+7d', 'one-sided review released to B', 'A has no peer review'] }));
process.exit(0);
