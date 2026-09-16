// Feature 6: participant-only chat, client UUID retries, Realtime delivery, read-only transitions, paging.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonClient, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { createPost, expectError, sleep } from './helpers/data.mjs';
import { subscribeInserts } from './helpers/realtime.mjs';
import { maskRealName } from '../../src/utils/maskName.ts';

const REQUEST_MESSAGE = '하네스 채팅 검증용 참여 요청입니다.';

async function ensureRequest(ctx, requester, post) {
  const { data, error } = await requester.sdk.rpc('create_join_request', { p_post_id: post.post.id, p_message: REQUEST_MESSAGE }).single();
  if (error) throw error;
  return data;
}

export async function feature06(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const postA = ctx.shared.postA || await createPost(ctx, a, 'A공고');
  const request = ctx.shared.requestB || await ensureRequest(ctx, b, postA);
  ctx.shared.postA = postA; ctx.shared.requestB = request;
  const send = (member, content, id = randomUUID(), requestId = request.id, senderId = member.userId) =>
    member.sdk.from('chat_messages').insert({ id, join_request_id: requestId, sender_id: senderId, content }).select().single();

  await feature.step('conversation header: A and B see masked counterpart and can_send; C refused', 'REMOTE', async () => {
    const forB = await b.sdk.rpc('get_conversation', { p_request_id: request.id }).single();
    assert.equal(forB.data.my_role, 'requester');
    assert.equal(forB.data.counterpart_masked_name, maskRealName(PERSONAS.A.realName));
    assert.equal(forB.data.can_send, true);
    const forA = await a.sdk.rpc('get_conversation', { p_request_id: request.id }).single();
    assert.equal(forA.data.my_role, 'author');
    assert.ok(!JSON.stringify([forA.data, forB.data]).includes(PERSONAS.B.realName));
    expectError(await c.sdk.rpc('get_conversation', { p_request_id: request.id }), 'C header');
    assert.ok((await b.sdk.rpc('list_conversations')).data.some(row => row.request_id === request.id));
  });

  let subA, subB, subC;
  await feature.step('A→B and B→A arrive over Realtime without reload; C receives nothing', 'REMOTE', async () => {
    const filter = `join_request_id=eq.${request.id}`;
    [subA, subB, subC] = await Promise.all([subscribeInserts(a, 'chat_messages', filter), subscribeInserts(b, 'chat_messages', filter), subscribeInserts(c, 'chat_messages', filter)]);
    await sleep(1000);
    const idB = randomUUID();
    const startedB = Date.now();
    const sentB = await send(b, `[${ctx.run.runId}] B가 보낸 첫 메시지`, idB);
    assert.equal(sentB.error, null, sentB.error?.message);
    const arrivedAtA = await subA.waitFor(row => row.id === idB);
    const idA = randomUUID();
    const startedA = Date.now();
    assert.equal((await send(a, `[${ctx.run.runId}] A의 답장`, idA)).error, null);
    const arrivedAtB = await subB.waitFor(row => row.id === idA);
    await sleep(2000);
    assert.equal(subC.events.length, 0, 'unrelated member received a chat event');
    ctx.shared.chatIds = [idB, idA];
    return { latencyBtoAms: arrivedAtA - startedB, latencyAtoBms: arrivedAtB - startedA };
  });
  await feature.step('same UUID retry is rejected by PK and the stored row stays single', 'REMOTE', async () => {
    const [idB] = ctx.shared.chatIds;
    const retry = await send(b, `[${ctx.run.runId}] B가 보낸 첫 메시지`, idB);
    assert.equal(retry.error?.code, '23505');
    const rows = await b.sdk.from('chat_messages').select('id').eq('id', idB);
    assert.equal(rows.data.length, 1);
    assert.equal(subA.events.filter(event => event.row.id === idB).length, 1, 'no duplicate realtime event');
  });
  await feature.step('history reloads in order for both; anon and C read nothing', 'REMOTE', async () => {
    for (const member of [a, b]) {
      const { data } = await member.sdk.from('chat_messages').select('id,sender_id,created_at').eq('join_request_id', request.id).order('created_at').order('id');
      assert.deepEqual(data.slice(-2).map(row => row.id), ctx.shared.chatIds);
    }
    assert.deepEqual((await c.sdk.from('chat_messages').select('id').eq('join_request_id', request.id)).data, []);
    const anonRead = await anon.from('chat_messages').select('id').eq('join_request_id', request.id);
    assert.ok(anonRead.error || anonRead.data.length === 0);
  });
  await feature.step('forged sender, outsider, anon and invalid content inserts are refused', 'REMOTE', async () => {
    expectError(await send(b, '명의 도용 메시지', randomUUID(), request.id, a.userId), 'forged sender');
    expectError(await send(c, '관계없는 사용자 메시지'), 'outsider');
    expectError(await anon.from('chat_messages').insert({ id: randomUUID(), join_request_id: request.id, sender_id: b.userId, content: '익명' }), 'anon');
    expectError(await send(b, '   '), 'blank');
    expectError(await send(b, '가'.repeat(1001)), 'too long');
    expectError(await b.sdk.from('chat_messages').insert({ id: randomUUID(), join_request_id: request.id, sender_id: b.userId, content: '시각 조작', created_at: '2001-01-01T00:00:00Z' }), 'created_at');
    expectError(await b.sdk.from('chat_messages').update({ content: '수정' }).eq('id', ctx.shared.chatIds[0]), 'update');
    expectError(await b.sdk.from('chat_messages').delete().eq('id', ctx.shared.chatIds[0]), 'delete');
  });
  await feature.step('closed channel no longer delivers', 'REMOTE', async () => {
    await subB.close();
    const id = randomUUID();
    assert.equal((await send(a, `[${ctx.run.runId}] 구독 해제 후 메시지`, id)).error, null);
    await subA.waitFor(row => row.id === id);
    await sleep(1500);
    assert.ok(!subB.events.some(event => event.row.id === id));
    await subA.close(); await subC.close();
  });
  await feature.step('50-message pages: newest 50 then older rest, no duplicates or gaps', 'REMOTE', async () => {
    const pagingPost = await createPost(ctx, a, '채팅페이지');
    const pagingRequest = await ensureRequest(ctx, b, pagingPost);
    const rows = Array.from({ length: 55 }, (_, index) => ({ id: randomUUID(), join_request_id: pagingRequest.id, sender_id: b.userId, content: `페이지 메시지 ${index + 1}` }));
    assert.equal((await b.sdk.from('chat_messages').insert(rows)).error, null);
    const page1 = await a.sdk.from('chat_messages').select('id,created_at').eq('join_request_id', pagingRequest.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    const oldest = page1.data.at(-1);
    const page2 = await a.sdk.from('chat_messages').select('id,created_at').eq('join_request_id', pagingRequest.id)
      .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    const all = [...page1.data, ...page2.data].map(row => row.id);
    assert.equal(page1.data.length, 50);
    assert.equal(page2.data.length, 5);
    assert.equal(new Set(all).size, 55);
    assert.deepEqual([...all].sort(), rows.map(row => row.id).sort());
  });
  await feature.step('withdrawn request becomes read-only for both participants', 'REMOTE', async () => {
    const post = await createPost(ctx, a, '채팅취소');
    const req = await ensureRequest(ctx, c, post);
    assert.equal((await send(c, '취소 전 메시지', randomUUID(), req.id)).error, null);
    await c.sdk.rpc('withdraw_join_request', { p_request_id: req.id });
    expectError(await send(c, '취소 후 메시지', randomUUID(), req.id), 'after withdraw (requester)');
    expectError(await send(a, '취소 후 답장', randomUUID(), req.id), 'after withdraw (author)');
    assert.equal((await a.sdk.from('chat_messages').select('id').eq('join_request_id', req.id)).data.length, 1);
    assert.equal((await c.sdk.rpc('get_conversation', { p_request_id: req.id }).single()).data.can_send, false);
  });
  await feature.step('declined request becomes read-only', 'REMOTE', async () => {
    const post = await createPost(ctx, a, '채팅거절');
    const req = await ensureRequest(ctx, c, post);
    await a.sdk.rpc('decline_join_request', { p_request_id: req.id });
    expectError(await send(c, '거절 후 메시지', randomUUID(), req.id), 'after decline');
  });
  await feature.step('after the meetup start (server time) a pending chat is read-only', 'REMOTE', async () => {
    const post = await createPost(ctx, a, '채팅시작', { startsInSeconds: 8, recruitmentLeadSeconds: 6, durationSeconds: 60 });
    const req = await ensureRequest(ctx, c, post);
    assert.equal((await send(c, '시작 전 메시지', randomUUID(), req.id)).error, null);
    await sleep(Math.max(0, Date.parse(post.post.starts_at) - Date.now()) + 1500);
    expectError(await send(c, '시작 후 메시지', randomUUID(), req.id), 'after start');
    assert.equal((await c.sdk.rpc('get_conversation', { p_request_id: req.id }).single()).data.can_send, false);
  });
}

standalone(import.meta.url, 'feature-06-chat', feature06);
