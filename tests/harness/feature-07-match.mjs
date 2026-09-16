// Feature 7: atomic final match, concurrency, exact-place disclosure only to the confirmed pair.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonClient } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { createPost, expectError, sleep } from './helpers/data.mjs';

const MESSAGE = '하네스 최종 확정 검증용 참여 요청입니다.';
const requestFrom = async (member, post) => {
  const { data, error } = await member.sdk.rpc('create_join_request', { p_post_id: post.post.id, p_message: MESSAGE }).single();
  if (error) throw error;
  return data;
};

export async function feature07(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const post = await createPost(ctx, a, '최종확정');
  const reqB = await requestFrom(b, post);
  const reqC = await requestFrom(c, post);
  let appointment;

  await feature.step('before the match nobody but the author reads the exact place', 'REMOTE', async () => {
    for (const member of [b, c]) assert.deepEqual((await member.sdk.from('post_private_details').select('*').eq('post_id', post.post.id)).data, []);
    assert.equal((await b.sdk.rpc('get_conversation', { p_request_id: reqB.id }).single()).data.appointment_id, null);
  });
  await feature.step('requesters, anon and outsiders cannot confirm', 'REMOTE', async () => {
    assert.equal(expectError(await b.sdk.rpc('confirm_match', { p_request_id: reqB.id }), 'requester').message, 'request_unavailable');
    assert.equal(expectError(await c.sdk.rpc('confirm_match', { p_request_id: reqB.id }), 'other requester').message, 'request_unavailable');
    expectError(await anon.rpc('confirm_match', { p_request_id: reqB.id }), 'anon');
    assert.equal(expectError(await a.sdk.rpc('confirm_match', { p_request_id: randomUUID() }), 'unknown').message, 'request_unavailable');
  });
  await feature.step('author confirms B: appointment + matched + not_selected + closed in one transaction', 'REMOTE', async () => {
    const { data, error } = await a.sdk.rpc('confirm_match', { p_request_id: reqB.id }).single();
    assert.equal(error, null, error?.message);
    assert.equal(data.already_confirmed, false);
    assert.equal(data.status, 'confirmed');
    appointment = data;
    const statuses = await a.sdk.from('join_requests').select('id,status').eq('post_id', post.post.id);
    assert.equal(statuses.data.find(row => row.id === reqB.id).status, 'matched');
    assert.equal(statuses.data.find(row => row.id === reqC.id).status, 'not_selected');
    assert.equal((await anon.from('posts').select('status').eq('id', post.post.id).single()).data.status, 'closed');
    ctx.shared.matchedAppointment = { appointment, post, reqB, reqC };
    return { appointment: data.appointment_id };
  });
  await feature.step('retrying the same confirm returns the same appointment; confirming another is refused', 'REMOTE', async () => {
    const retry = await a.sdk.rpc('confirm_match', { p_request_id: reqB.id }).single();
    assert.equal(retry.data.appointment_id, appointment.appointment_id);
    assert.equal(retry.data.already_confirmed, true);
    assert.equal(expectError(await a.sdk.rpc('confirm_match', { p_request_id: reqC.id }), 'second').message, 'already_matched');
    assert.equal((await a.sdk.from('appointments').select('id').eq('post_id', post.post.id)).data.length, 1);
  });
  await feature.step('two tabs confirming different requests at once create exactly one appointment', 'REMOTE', async () => {
    const racePost = await createPost(ctx, a, '동시확정');
    const [r1, r2] = [await requestFrom(b, racePost), await requestFrom(c, racePost)];
    const results = await Promise.all([r1, r2, r1].map(request => a.sdk.rpc('confirm_match', { p_request_id: request.id }).single()));
    const successes = results.filter(result => !result.error);
    assert.ok(successes.length >= 1);
    assert.equal(new Set(successes.map(result => result.data.appointment_id)).size, 1);
    assert.ok(results.filter(result => result.error).every(result => result.error.message === 'already_matched'));
    assert.equal((await a.sdk.from('appointments').select('id').eq('post_id', racePost.post.id)).data.length, 1);
    const rows = (await a.sdk.from('join_requests').select('status').eq('post_id', racePost.post.id)).data.map(row => row.status).sort();
    assert.deepEqual(rows, ['matched', 'not_selected']);
  });
  await feature.step('exact place: A and B read it; not-selected C, anon and public responses do not', 'REMOTE', async () => {
    for (const member of [a, b]) {
      const row = await member.sdk.from('post_private_details').select('exact_location').eq('post_id', post.post.id).single();
      assert.equal(row.data.exact_location, post.exactLocation);
    }
    assert.deepEqual((await c.sdk.from('post_private_details').select('*').eq('post_id', post.post.id)).data, []);
    const anonRead = await anon.from('post_private_details').select('*').eq('post_id', post.post.id);
    assert.ok(anonRead.error || anonRead.data.length === 0);
    const publicText = JSON.stringify([
      (await anon.from('posts').select('*').eq('id', post.post.id)).data,
      (await b.sdk.rpc('list_sent_join_requests')).data,
      (await a.sdk.rpc('list_received_join_requests')).data,
      (await b.sdk.rpc('list_my_appointments')).data,
      (await b.sdk.rpc('get_conversation', { p_request_id: reqB.id })).data,
    ]);
    assert.ok(!publicText.includes(post.exactLocation), 'exact place leaked into a public/list response');
  });
  await feature.step('appointment visible to A and B only; conversation exposes its id only to the pair', 'REMOTE', async () => {
    for (const member of [a, b]) {
      assert.equal((await member.sdk.from('appointments').select('id').eq('id', appointment.appointment_id)).data.length, 1);
      assert.ok((await member.sdk.rpc('list_my_appointments')).data.some(row => row.appointment_id === appointment.appointment_id));
    }
    assert.deepEqual((await c.sdk.from('appointments').select('id').eq('id', appointment.appointment_id)).data, []);
    assert.ok(!(await c.sdk.rpc('list_my_appointments')).data.some(row => row.appointment_id === appointment.appointment_id));
    assert.equal((await b.sdk.rpc('get_conversation', { p_request_id: reqB.id }).single()).data.appointment_id, appointment.appointment_id);
    assert.equal((await c.sdk.rpc('get_conversation', { p_request_id: reqC.id }).single()).data.appointment_id, null);
  });
  await feature.step('matched chat stays writable; not_selected chat is read-only; matched request cannot be withdrawn', 'REMOTE', async () => {
    const ok = await b.sdk.from('chat_messages').insert({ id: randomUUID(), join_request_id: reqB.id, sender_id: b.userId, content: '확정 후 메시지' });
    assert.equal(ok.error, null, ok.error?.message);
    expectError(await c.sdk.from('chat_messages').insert({ id: randomUUID(), join_request_id: reqC.id, sender_id: c.userId, content: '미선택 후 메시지' }), 'not_selected send');
    assert.equal(expectError(await b.sdk.rpc('withdraw_join_request', { p_request_id: reqB.id }), 'withdraw matched').message, 'invalid_transition');
    assert.equal(expectError(await a.sdk.rpc('decline_join_request', { p_request_id: reqC.id }), 'decline not_selected').message, 'invalid_transition');
  });
  await feature.step('failed confirm (meetup already started) changes nothing', 'REMOTE', async () => {
    const late = await createPost(ctx, a, '시작후확정', { startsInSeconds: 7, recruitmentLeadSeconds: 5, durationSeconds: 60 });
    const request = await requestFrom(b, late);
    await sleep(Math.max(0, Date.parse(late.post.starts_at) - Date.now()) + 1500);
    assert.equal(expectError(await a.sdk.rpc('confirm_match', { p_request_id: request.id }), 'late').message, 'match_window_closed');
    assert.equal((await a.sdk.from('join_requests').select('status').eq('id', request.id).single()).data.status, 'pending');
    assert.equal((await anon.from('posts').select('status').eq('id', late.post.id).single()).data.status, 'recruiting');
    assert.deepEqual((await a.sdk.from('appointments').select('id').eq('post_id', late.post.id)).data, []);
    assert.deepEqual((await b.sdk.from('post_private_details').select('*').eq('post_id', late.post.id)).data, []);
  });
  await feature.step('direct REST writes to appointments are refused', 'REMOTE', async () => {
    expectError(await a.sdk.from('appointments').insert({ post_id: post.post.id, join_request_id: reqC.id }), 'insert');
    expectError(await a.sdk.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.appointment_id), 'update');
  });
}

standalone(import.meta.url, 'feature-07-match', feature07);
