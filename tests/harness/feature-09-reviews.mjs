// Feature 9: blind mutual reviews — eligibility, single immutable submission, simultaneous release, no raw access.
import assert from 'node:assert/strict';
import { anonClient } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { expectError, shortAppointment, sleep, waitUntil } from './helpers/data.mjs';
import { subscribeInserts } from './helpers/realtime.mjs';

export async function feature09(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const target = await shortAppointment(ctx, a, b, '평가검증');
  const id = target.appointmentId;
  const commentA = `A가 남긴 한마디 ${ctx.run.runId}`;
  const commentB = `B가 남긴 한마디 ${ctx.run.runId}`;
  const state = member => member.sdk.rpc('get_appointment_review_state', { p_appointment_id: id }).single();
  const submit = (member, rating, comment) => member.sdk.rpc('submit_appointment_review', { p_appointment_id: id, p_rating: rating, p_comment: comment }).single();
  let reviewEvents;

  await feature.step('no review before own completion (even after ends_at)', 'REMOTE', async () => {
    await waitUntil(target.endsAt);
    for (const member of [a, b]) assert.equal(expectError(await submit(member, 5, null), 'before completion').message, 'completion_required');
    assert.equal((await state(a)).data.can_write, false);
  });
  await feature.step('raw review table is closed to A, B, C and anon; not in Realtime', 'REMOTE', async () => {
    for (const client of [a.sdk, b.sdk, c.sdk, anon]) {
      const read = await client.from('appointment_reviews').select('*').eq('appointment_id', id);
      assert.ok(read.error, 'raw review select must be denied');
      expectError(await client.from('appointment_reviews').insert({ appointment_id: id, reviewer_id: b.userId, rating: 5 }), 'raw insert');
    }
    reviewEvents = await subscribeInserts(b, 'appointment_reviews', `appointment_id=eq.${id}`).catch(error => ({ error }));
  });
  await feature.step('A completes and submits; validation and duplicate/changed resubmits handled', 'REMOTE', async () => {
    await a.sdk.rpc('confirm_appointment_completion', { p_appointment_id: id });
    assert.equal((await state(a)).data.can_write, true, 'A may review without B completion');
    for (const [rating, comment, message] of [[0, null, 'invalid_rating'], [6, null, 'invalid_rating'], [4, '가'.repeat(301), 'invalid_comment']])
      assert.equal(expectError(await submit(a, rating, comment), 'invalid').message, message);
    assert.equal((await state(a)).data.own_review, null, 'invalid attempts left no row');
    const [first, retry] = await Promise.all([submit(a, 5, `  ${commentA}  `), submit(a, 5, commentA)]);
    assert.equal(first.error, null, first.error?.message);
    assert.equal(retry.error, null, 'identical retry returns the stored state');
    assert.equal(first.data.own_review.rating, 5);
    assert.equal(first.data.own_review.comment, commentA);
    assert.equal(first.data.released, false);
    assert.equal(first.data.peer_review, null);
    assert.equal(expectError(await submit(a, 1, '바꾼 평가'), 'changed').message, 'already_submitted');
  });
  await feature.step('B sees only that A submitted — no rating/comment anywhere; A sees no peer review', 'REMOTE', async () => {
    const forB = await state(b);
    assert.equal(forB.data.peer_submitted, true);
    assert.equal(forB.data.peer_review, null);
    assert.equal(forB.data.own_review, null);
    assert.equal(forB.data.can_write, false, 'B not completed yet');
    const forA = await state(a);
    assert.equal(forA.data.peer_submitted, false);
    assert.equal(forA.data.peer_review, null);
    const visibleToB = JSON.stringify([forB.data, (await b.sdk.rpc('get_appointment_state', { p_appointment_id: id })).data, (await b.sdk.rpc('list_my_appointments')).data, (await b.sdk.rpc('list_conversations')).data]);
    assert.ok(!visibleToB.includes(commentA), 'A comment leaked to B before release');
    await sleep(1500);
    if (reviewEvents.error) return { realtime: 'subscription refused' };
    assert.equal(reviewEvents.events.length, 0, 'review row delivered over Realtime');
    await reviewEvents.close();
    return { realtime: 'no events' };
  });
  await feature.step('C and anon cannot learn review existence or content', 'REMOTE', async () => {
    assert.equal(expectError(await state(c), 'C').message, 'appointment_unavailable');
    expectError(await anon.rpc('get_appointment_review_state', { p_appointment_id: id }), 'anon');
    assert.equal(expectError(await submit(c, 5, null), 'C submit').message, 'appointment_unavailable');
  });
  let completionBefore;
  await feature.step('B completes, submits blind; both see both reviews at once', 'REMOTE', async () => {
    await b.sdk.rpc('confirm_appointment_completion', { p_appointment_id: id });
    completionBefore = (await a.sdk.from('appointment_completion_confirmations').select('user_id,confirmed_at').eq('appointment_id', id).order('user_id')).data;
    const before = await state(b);
    assert.equal(before.data.peer_review, null, 'still hidden right before B submits');
    const result = await submit(b, 4, commentB);
    assert.equal(result.error, null, result.error?.message);
    assert.equal(result.data.released, true);
    assert.equal(result.data.peer_review.rating, 5);
    assert.equal(result.data.peer_review.comment, commentA);
    const forA = await state(a);
    assert.equal(forA.data.released, true);
    assert.equal(forA.data.peer_review.rating, 4);
    assert.equal(forA.data.peer_review.comment, commentB);
  });
  await feature.step('reviews did not modify completion rows or appointment status', 'REMOTE', async () => {
    const after = (await a.sdk.from('appointment_completion_confirmations').select('user_id,confirmed_at').eq('appointment_id', id).order('user_id')).data;
    assert.deepEqual(after, completionBefore);
    assert.equal((await a.sdk.from('appointments').select('status').eq('id', id).single()).data.status, 'completed');
  });
  await feature.step('near-simultaneous submissions settle one consistent released state', 'REMOTE', async () => {
    const race = await shortAppointment(ctx, b, a, '동시평가');
    await waitUntil(race.endsAt);
    await Promise.all([a, b].map(member => member.sdk.rpc('confirm_appointment_completion', { p_appointment_id: race.appointmentId })));
    const results = await Promise.all([[a, 3], [b, 2]].map(([member, rating]) => member.sdk.rpc('submit_appointment_review', { p_appointment_id: race.appointmentId, p_rating: rating, p_comment: null }).single()));
    assert.ok(results.every(result => !result.error));
    const [sa, sb] = await Promise.all([a, b].map(member => member.sdk.rpc('get_appointment_review_state', { p_appointment_id: race.appointmentId }).single()));
    assert.equal(sa.data.released, true);
    assert.equal(sb.data.released, true);
    assert.equal(sa.data.peer_review.rating, 2);
    assert.equal(sb.data.peer_review.rating, 3);
  });
  await feature.step('deadline boundary: open just before ends_at+7d, closed exactly at it (server function used by the RPC)', 'REMOTE', async () => {
    const ends = new Date(target.post.post.ends_at);
    const deadline = new Date(ends.getTime() + 7 * 24 * 3600 * 1000);
    const open = await a.sdk.rpc('review_submission_open', { p_ends_at: ends.toISOString(), p_at: new Date(deadline.getTime() - 1).toISOString() });
    const closed = await a.sdk.rpc('review_submission_open', { p_ends_at: ends.toISOString(), p_at: deadline.toISOString() });
    assert.equal(open.data, true);
    assert.equal(closed.data, false);
    assert.equal(Date.parse((await state(a)).data.deadline_at), deadline.getTime());
  });
  await feature.step('review responses contain no raw personal data or exact place', 'REMOTE', async () => {
    const text = JSON.stringify([(await state(a)).data, (await state(b)).data]);
    for (const leak of ['real_name', 'birth_date', 'phone', 'reviewer_id', 'reviewee', target.post.exactLocation]) assert.ok(!text.includes(leak));
  });
  ctx.shared.reviewTarget = target;
}

standalone(import.meta.url, 'feature-09-reviews', feature09);
