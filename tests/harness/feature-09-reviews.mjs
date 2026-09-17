// Feature 9: blind reviews — 24h hold, mutual release after hold, one-sided release at 7d.
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

  await feature.step('no review before appointment completion (even after ends_at)', 'REMOTE', async () => {
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
    assert.equal((await state(a)).data.can_write, true);
    assert.equal((await state(b)).data.can_write, true, 'one participant completion opens reviews for both');
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
    assert.equal(forB.data.can_write, true, 'B may write after the appointment-level completion');
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
  await feature.step('B submits blind during the 24h hold; both reviews remain hidden', 'REMOTE', async () => {
    completionBefore = (await a.sdk.from('appointment_completion_confirmations').select('user_id,confirmed_at').eq('appointment_id', id).order('user_id')).data;
    assert.equal(completionBefore.length, 1);
    const before = await state(b);
    assert.equal(before.data.peer_review, null, 'still hidden right before B submits');
    const result = await submit(b, 4, commentB);
    assert.equal(result.error, null, result.error?.message);
    assert.equal(result.data.released, false);
    assert.equal(result.data.peer_review, null);
    const forA = await state(a);
    assert.equal(forA.data.released, false);
    assert.equal(forA.data.peer_review, null);
    assert.equal(Date.parse(forA.data.hold_until) - Date.parse(forA.data.server_now) > 0, true);
  });
  await feature.step('reviews did not modify completion rows or appointment status', 'REMOTE', async () => {
    const after = (await a.sdk.from('appointment_completion_confirmations').select('user_id,confirmed_at').eq('appointment_id', id).order('user_id')).data;
    assert.deepEqual(after, completionBefore);
    assert.equal((await a.sdk.from('appointments').select('status').eq('id', id).single()).data.status, 'completed');
  });
  await feature.step('near-simultaneous submissions settle one consistent held state', 'REMOTE', async () => {
    const race = await shortAppointment(ctx, b, a, '동시평가');
    await waitUntil(race.endsAt);
    await Promise.all([a, b].map(member => member.sdk.rpc('confirm_appointment_completion', { p_appointment_id: race.appointmentId })));
    const results = await Promise.all([[a, 3], [b, 2]].map(([member, rating]) => member.sdk.rpc('submit_appointment_review', { p_appointment_id: race.appointmentId, p_rating: rating, p_comment: null }).single()));
    assert.ok(results.every(result => !result.error));
    const [sa, sb] = await Promise.all([a, b].map(member => member.sdk.rpc('get_appointment_review_state', { p_appointment_id: race.appointmentId }).single()));
    assert.equal(sa.data.released, false);
    assert.equal(sb.data.released, false);
    assert.equal(sa.data.peer_review, null);
    assert.equal(sb.data.peer_review, null);
  });
  await feature.step('deadline boundary is completed_at+7d and exact', 'REMOTE', async () => {
    const current = await state(a);
    const completion = (await a.sdk.from('appointments').select('completed_at,status').eq('id', id).single()).data;
    const deadline = new Date(Date.parse(completion.completed_at) + 7 * 24 * 3600 * 1000);
    const args = { p_completed_at: completion.completed_at, p_deadline_at: deadline.toISOString(), p_status: completion.status };
    const open = await a.sdk.rpc('review_submission_open', { ...args, p_at: new Date(deadline.getTime() - 1).toISOString() });
    const closed = await a.sdk.rpc('review_submission_open', { ...args, p_at: deadline.toISOString() });
    assert.equal(open.data, true);
    assert.equal(closed.data, false);
    assert.equal(Date.parse(current.data.deadline_at), deadline.getTime());
  });
  await feature.step('review responses contain no raw personal data or exact place', 'REMOTE', async () => {
    const text = JSON.stringify([(await state(a)).data, (await state(b)).data]);
    for (const leak of ['real_name', 'birth_date', 'phone', 'reviewer_id', 'reviewee', target.post.exactLocation]) assert.ok(!text.includes(leak));
  });
  ctx.shared.reviewTarget = target;
}

standalone(import.meta.url, 'feature-09-reviews', feature09);
