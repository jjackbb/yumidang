// Feature 8: the first participant completes the appointment; the peer may dispute for 24h.
import assert from 'node:assert/strict';
import { anonClient } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { expectError, shortAppointment, waitUntil } from './helpers/data.mjs';

export async function feature08(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const target = await shortAppointment(ctx, a, b, '완료검증');
  const id = target.appointmentId;
  const confirm = member => member.sdk.rpc('confirm_appointment_completion', { p_appointment_id: id }).single();
  const reviewState = member => member.sdk.rpc('get_appointment_review_state', { p_appointment_id: id }).single();

  await feature.step('before ends_at (server time) both confirmations are refused and no row is written', 'REMOTE', async () => {
    assert.ok(Date.now() < target.endsAt);
    for (const member of [a, b]) assert.equal(expectError(await confirm(member), 'early').message, 'too_early');
    assert.deepEqual((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data, []);
    const state = await a.sdk.rpc('get_appointment_state', { p_appointment_id: id }).single();
    assert.equal(state.data.can_confirm_completion, false);
    assert.equal((await reviewState(a)).data.can_write, false, 'no review eligibility before own completion');
  });
  await feature.step('outsiders and anon can neither read nor confirm', 'REMOTE', async () => {
    assert.equal(expectError(await confirm(c), 'C').message, 'appointment_unavailable');
    expectError(await anon.rpc('confirm_appointment_completion', { p_appointment_id: id }), 'anon');
    expectError(await c.sdk.rpc('get_appointment_state', { p_appointment_id: id }), 'C state');
    assert.deepEqual((await c.sdk.from('appointment_completion_confirmations').select('*').eq('appointment_id', id)).data, []);
  });
  await feature.step('after ends_at A double-clicks: appointment completes once and both may review', 'REMOTE', async () => {
    await waitUntil(target.endsAt);
    const [first, second] = await Promise.all([confirm(a), confirm(a)]);
    assert.equal(first.error, null, first.error?.message);
    assert.equal(second.error, null);
    assert.equal(first.data.status, 'completed');
    assert.equal(first.data.completion_method, 'manual');
    assert.ok(first.data.completed_at);
    assert.ok(first.data.my_confirmed_at);
    assert.equal((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 1);
    assert.equal((await reviewState(a)).data.can_write, true);
    assert.equal((await reviewState(b)).data.can_write, true);
    const forB = await b.sdk.rpc('get_appointment_state', { p_appointment_id: id }).single();
    assert.ok(forB.data.peer_completion_at, 'B sees A confirmed');
    assert.equal(forB.data.my_completion_at, null);
    assert.equal(forB.data.can_dispute, true);
    assert.equal((await a.sdk.rpc('get_appointment_state', { p_appointment_id: id }).single()).data.can_dispute, false);
    assert.equal(Date.parse(first.data.dispute_deadline_at) - Date.parse(first.data.completion_notified_at), 24 * 3600 * 1000);
  });
  await feature.step('no client-chosen user id: the RPC accepts no user parameter; direct inserts are refused', 'REMOTE', async () => {
    expectError(await a.sdk.rpc('confirm_appointment_completion', { p_appointment_id: id, p_user_id: b.userId }), 'user spoof');
    expectError(await a.sdk.from('appointment_completion_confirmations').insert({ appointment_id: id, user_id: b.userId }), 'direct insert');
    expectError(await a.sdk.from('appointment_completion_confirmations').delete().eq('appointment_id', id), 'delete');
    assert.equal((await b.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 1);
  });
  await feature.step('peer completion calls are idempotent and never create a second audit row', 'REMOTE', async () => {
    const result = await confirm(b);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'completed');
    assert.equal(result.data.my_confirmed_at, null);
    assert.equal(result.data.completed_by_me, false);
    const again = await confirm(a);
    assert.equal(again.data.completed_at, result.data.completed_at, 'completed_at not rewritten');
    assert.equal((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 1);
    assert.equal((await reviewState(b)).data.can_write, true);
    const row = await b.sdk.from('appointments').select('status,completed_at,completed_by_user_id').eq('id', id).single();
    assert.equal(row.data.status, 'completed');
    assert.equal(row.data.completed_by_user_id, a.userId);
  });
  await feature.step('simultaneous confirmations end in one audit actor and one completion timestamp', 'REMOTE', async () => {
    const race = await shortAppointment(ctx, a, b, '동시완료');
    await waitUntil(race.endsAt);
    const results = await Promise.all([a, b].map(member => member.sdk.rpc('confirm_appointment_completion', { p_appointment_id: race.appointmentId }).single()));
    assert.ok(results.every(result => !result.error));
    const row = await a.sdk.from('appointments').select('status,completed_at').eq('id', race.appointmentId).single();
    assert.equal(row.data.status, 'completed');
    const audits = (await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', race.appointmentId)).data;
    assert.equal(audits.length, 1);
    assert.ok([a.userId, b.userId].includes(audits[0].user_id));
  });
  await feature.step('only the non-actor may dispute manual completion; opening freezes reviews', 'REMOTE', async () => {
    assert.equal(expectError(await a.sdk.rpc('raise_appointment_dispute', { p_appointment_id: id, p_reason: '제가 완료했으므로 이의 대상이 아닙니다.' }), 'actor dispute').message, 'dispute_not_allowed');
    const opened = await b.sdk.rpc('raise_appointment_dispute', { p_appointment_id: id, p_reason: '실제 동행 여부를 확인해 주세요.' }).single();
    assert.equal(opened.error, null, opened.error?.message);
    assert.equal(opened.data.status, 'disputed');
    assert.equal((await reviewState(a)).data.disputed, true);
    assert.equal((await reviewState(a)).data.can_write, false);
    assert.equal(expectError(await a.sdk.rpc('submit_appointment_review', { p_appointment_id: id, p_rating: 5, p_comment: null }), 'review during dispute').message, 'review_paused_by_dispute');
    assert.equal((await b.sdk.rpc('raise_appointment_dispute', { p_appointment_id: id, p_reason: '실제 동행 여부를 확인해 주세요.' }).single()).data.raised_at, opened.data.raised_at);
  });
  await feature.step('automatic completion boundary is exact; scheduler behavior is verified separately', 'REMOTE', async () => {
    const ends = '2026-09-17T00:00:00.000Z';
    assert.equal((await a.sdk.rpc('automatic_completion_due', { p_ends_at: ends, p_status: 'confirmed', p_at: '2026-09-17T23:59:59.999Z' })).data, false);
    assert.equal((await a.sdk.rpc('automatic_completion_due', { p_ends_at: ends, p_status: 'confirmed', p_at: '2026-09-18T00:00:00.000Z' })).data, true);
    assert.equal((await a.sdk.rpc('automatic_completion_due', { p_ends_at: ends, p_status: 'cancelled', p_at: '2026-09-18T00:00:00.000Z' })).data, false);
  });
  await feature.step('completion responses carry no raw personal data', 'REMOTE', async () => {
    const text = JSON.stringify((await a.sdk.rpc('get_appointment_state', { p_appointment_id: id })).data);
    for (const leak of ['real_name', 'birth_date', 'phone', target.post.exactLocation]) assert.ok(!text.includes(leak));
  });
  ctx.shared.completionTarget = target;
}

standalone(import.meta.url, 'feature-08-completion', feature08);
