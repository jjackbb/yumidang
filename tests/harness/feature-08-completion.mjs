// Feature 8: per-participant completion after server-time ends_at; second confirmation completes atomically.
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
  await feature.step('after ends_at A confirms (double click): one row, appointment still confirmed, A may review, B may not', 'REMOTE', async () => {
    await waitUntil(target.endsAt);
    const [first, second] = await Promise.all([confirm(a), confirm(a)]);
    assert.equal(first.error, null, first.error?.message);
    assert.equal(second.error, null);
    assert.equal(first.data.status, 'confirmed');
    assert.equal(first.data.completed_at, null);
    assert.ok(first.data.my_confirmed_at);
    assert.equal(first.data.peer_confirmed_at, null);
    assert.equal((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 1);
    assert.equal((await reviewState(a)).data.can_write, true);
    assert.equal((await reviewState(b)).data.can_write, false);
    const forB = await b.sdk.rpc('get_appointment_state', { p_appointment_id: id }).single();
    assert.ok(forB.data.peer_completion_at, 'B sees A confirmed');
    assert.equal(forB.data.my_completion_at, null);
  });
  await feature.step('no client-chosen user id: the RPC accepts no user parameter; direct inserts are refused', 'REMOTE', async () => {
    expectError(await a.sdk.rpc('confirm_appointment_completion', { p_appointment_id: id, p_user_id: b.userId }), 'user spoof');
    expectError(await a.sdk.from('appointment_completion_confirmations').insert({ appointment_id: id, user_id: b.userId }), 'direct insert');
    expectError(await a.sdk.from('appointment_completion_confirmations').delete().eq('appointment_id', id), 'delete');
    assert.equal((await b.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 1);
  });
  await feature.step('B confirms: completed + completed_at set together; retries keep two rows', 'REMOTE', async () => {
    const result = await confirm(b);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'completed');
    assert.ok(result.data.completed_at);
    assert.ok(Date.parse(result.data.completed_at) >= Date.parse(result.data.my_confirmed_at) - 1000);
    const again = await confirm(a);
    assert.equal(again.data.completed_at, result.data.completed_at, 'completed_at not rewritten');
    assert.equal((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', id)).data.length, 2);
    assert.equal((await reviewState(b)).data.can_write, true);
    const row = await b.sdk.from('appointments').select('status,completed_at').eq('id', id).single();
    assert.equal(row.data.status, 'completed');
  });
  await feature.step('simultaneous confirmations from both people end in two rows and one completion', 'REMOTE', async () => {
    const race = await shortAppointment(ctx, a, b, '동시완료');
    await waitUntil(race.endsAt);
    const results = await Promise.all([a, b].map(member => member.sdk.rpc('confirm_appointment_completion', { p_appointment_id: race.appointmentId }).single()));
    assert.ok(results.every(result => !result.error));
    const row = await a.sdk.from('appointments').select('status,completed_at').eq('id', race.appointmentId).single();
    assert.equal(row.data.status, 'completed');
    assert.equal((await a.sdk.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', race.appointmentId)).data.length, 2);
  });
  await feature.step('completion responses carry no raw personal data', 'REMOTE', async () => {
    const text = JSON.stringify((await a.sdk.rpc('get_appointment_state', { p_appointment_id: id })).data);
    for (const leak of ['real_name', 'birth_date', 'phone', target.post.exactLocation]) assert.ok(!text.includes(leak));
  });
  ctx.shared.completionTarget = target;
}

standalone(import.meta.url, 'feature-08-completion', feature08);
