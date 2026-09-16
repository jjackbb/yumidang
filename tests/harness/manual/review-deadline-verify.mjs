// Manual check (step 2/2): after the post schedule was moved past ends_at+7d, B's late review is refused
// and A's one-sided review stays hidden (no automatic release).
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
assert.equal(forB.peer_review, null);
assert.equal(forB.released, false);
assert.equal(forA.released, false);
assert.equal(forA.peer_review, null);
console.log(JSON.stringify({ result: 'PASS', checks: ['late submit refused after ends_at+7d', 'one-sided review not auto-released for B', 'A still sees no peer review'] }));
process.exit(0);
