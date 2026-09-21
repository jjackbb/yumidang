// Feature 5: join requests — server-decided requester, duplicates, transitions, visibility, privacy.
import assert from 'node:assert/strict';
import { anonClient, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { createPost, DELETED_FIXTURE_POST_ID, expectError, sleep } from './helpers/data.mjs';
import { maskRealName } from '../../frontend/src/utils/maskName.ts';

const MESSAGE = '하네스 참여 요청 메시지입니다. 반갑습니다.';

export async function feature05(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const postA = ctx.shared.postA || await createPost(ctx, a, 'A공고');
  const postB = ctx.shared.postB || await createPost(ctx, b, 'B공고');
  const withdrawPost = await createPost(ctx, a, '취소검증');
  const declinePost = await createPost(ctx, a, '거절검증');
  let request;

  await feature.step('anon cannot create or list requests', 'REMOTE', async () => {
    expectError(await anon.rpc('create_join_request', { p_post_id: postA.post.id, p_message: MESSAGE }), 'anon create');
    expectError(await anon.rpc('list_sent_join_requests'), 'anon list');
    const direct = await anon.from('join_requests').select('*');
    assert.ok(direct.error || direct.data.length === 0);
  });
  await feature.step('B requests A post once: pending, requester decided by the session', 'REMOTE', async () => {
    const { data, error } = await b.sdk.rpc('create_join_request', { p_post_id: postA.post.id, p_message: `  ${MESSAGE}  ` }).single();
    assert.equal(error, null, error?.message);
    assert.equal(data.status, 'pending');
    assert.equal(data.already_existed, false);
    request = data;
    const row = await b.sdk.from('join_requests').select('requester_id,message').eq('id', data.id).single();
    assert.equal(row.data.requester_id, b.userId);
    assert.equal(row.data.message, MESSAGE, 'message trimmed by server');
    ctx.shared.requestB = data;
    expectError(await b.sdk.rpc('create_join_request', { p_post_id: postA.post.id, p_message: MESSAGE, p_requester_id: c.userId }), 'requester spoof parameter');
  });
  await feature.step('repeat and parallel submits keep exactly one request', 'REMOTE', async () => {
    const again = await b.sdk.rpc('create_join_request', { p_post_id: postA.post.id, p_message: MESSAGE }).single();
    assert.equal(again.data.id, request.id);
    assert.equal(again.data.already_existed, true);
    const burst = await Promise.all(Array.from({ length: 4 }, () => c.sdk.rpc('create_join_request', { p_post_id: withdrawPost.post.id, p_message: MESSAGE }).single()));
    assert.ok(burst.every(result => !result.error), burst.find(result => result.error)?.error?.message);
    assert.equal(new Set(burst.map(result => result.data.id)).size, 1);
    assert.equal(burst.filter(result => result.data.already_existed === false).length, 1);
    const rows = await c.sdk.from('join_requests').select('id').eq('post_id', withdrawPost.post.id);
    assert.equal(rows.data.length, 1);
  });
  await feature.step('own post, closed/deleted posts and short messages are refused without rows', 'REMOTE', async () => {
    assert.equal(expectError(await a.sdk.rpc('create_join_request', { p_post_id: postA.post.id, p_message: MESSAGE }), 'own').message, 'own_post');
    let closed = ctx.shared.closedPost;
    if (!closed) { closed = await createPost(ctx, c, '마감예정', { recruitmentLeadSeconds: 3 }); await sleep(5000); }
    assert.equal(expectError(await b.sdk.rpc('create_join_request', { p_post_id: closed.post.id, p_message: MESSAGE }), 'closed').message, 'recruitment_closed');
    assert.equal(expectError(await b.sdk.rpc('create_join_request', { p_post_id: DELETED_FIXTURE_POST_ID, p_message: MESSAGE }), 'deleted').message, 'post_unavailable');
    assert.equal(expectError(await b.sdk.rpc('create_join_request', { p_post_id: postB.post.id, p_message: MESSAGE }), 'B own').message, 'own_post');
    assert.equal(expectError(await b.sdk.rpc('create_join_request', { p_post_id: declinePost.post.id, p_message: '짧아요' }), 'short').message, 'invalid_message');
    assert.deepEqual((await b.sdk.from('join_requests').select('id').eq('post_id', declinePost.post.id)).data, []);
  });
  await feature.step('sent/received lists show masked names and ages only; C sees nothing', 'REMOTE', async () => {
    const sent = await b.sdk.rpc('list_sent_join_requests');
    const mine = sent.data.find(row => row.id === request.id);
    assert.equal(mine.author_masked_name, maskRealName(PERSONAS.A.realName));
    assert.equal(mine.status, 'pending');
    const received = await a.sdk.rpc('list_received_join_requests');
    const theirs = received.data.find(row => row.id === request.id);
    assert.equal(theirs.requester_masked_name, maskRealName(PERSONAS.B.realName));
    assert.equal(typeof theirs.requester_age, 'number');
    const text = JSON.stringify([sent.data, received.data]);
    for (const leak of ['real_name', 'birth_date', 'phone', PERSONAS.A.realName, PERSONAS.B.realName, PERSONAS.B.birthDate, 'requester_id', 'author_id']) assert.ok(!text.includes(leak), `list leaked ${leak.length > 12 ? 'value' : leak}`);
    assert.ok(!(await c.sdk.rpc('list_received_join_requests')).data.some(row => row.id === request.id));
    assert.ok(!(await c.sdk.rpc('list_sent_join_requests')).data.some(row => row.id === request.id));
    assert.deepEqual((await c.sdk.from('join_requests').select('id').eq('id', request.id)).data, []);
  });
  await feature.step('counterpart profile: B↔A only; C refused', 'REMOTE', async () => {
    assert.equal((await b.sdk.rpc('get_request_counterpart_profile', { p_request_id: request.id }).single()).data.masked_name, maskRealName(PERSONAS.A.realName));
    assert.equal((await a.sdk.rpc('get_request_counterpart_profile', { p_request_id: request.id }).single()).data.masked_name, maskRealName(PERSONAS.B.realName));
    expectError(await c.sdk.rpc('get_request_counterpart_profile', { p_request_id: request.id }), 'C counterpart');
  });
  await feature.step('only the requester withdraws, only the author declines; others get a generic refusal', 'REMOTE', async () => {
    for (const [member, fn] of [[c, 'withdraw_join_request'], [a, 'withdraw_join_request'], [b, 'decline_join_request'], [c, 'decline_join_request']])
      assert.equal(expectError(await member.sdk.rpc(fn, { p_request_id: request.id }), fn).message, 'request_unavailable');
    const state = await b.sdk.from('join_requests').select('status').eq('id', request.id).single();
    assert.equal(state.data.status, 'pending');
  });
  await feature.step('withdraw → new request/new chat; old history stays readable and read-only', 'REMOTE', async () => {
    const own = await c.sdk.from('join_requests').select('id').eq('post_id', withdrawPost.post.id).single();
    const oldMessage = { id: crypto.randomUUID(), join_request_id: own.data.id, sender_id: c.userId, content: `이전 대화 ${ctx.run.runId}` };
    assert.equal((await c.sdk.from('chat_messages').insert(oldMessage)).error, null);
    const first = await c.sdk.rpc('withdraw_join_request', { p_request_id: own.data.id }).single();
    assert.equal(first.data.status, 'withdrawn');
    assert.equal((await c.sdk.rpc('withdraw_join_request', { p_request_id: own.data.id }).single()).data.status, 'withdrawn');
    assert.equal(expectError(await a.sdk.rpc('decline_join_request', { p_request_id: own.data.id }), 'decline withdrawn').message, 'invalid_transition');
    expectError(await c.sdk.from('chat_messages').insert({ id: crypto.randomUUID(), join_request_id: own.data.id, sender_id: c.userId, content: '취소 뒤 전송은 거절되어야 합니다.' }), 'old chat write');
    const again = await c.sdk.rpc('create_join_request', { p_post_id: withdrawPost.post.id, p_message: MESSAGE }).single();
    assert.equal(again.data.already_existed, false);
    assert.equal(again.data.status, 'pending');
    assert.notEqual(again.data.id, own.data.id);
    const rows = await c.sdk.from('join_requests').select('id,status').eq('post_id', withdrawPost.post.id).order('created_at');
    assert.deepEqual(rows.data.map(row => row.status), ['withdrawn', 'pending']);
    assert.equal((await c.sdk.from('chat_messages').select('content').eq('join_request_id', own.data.id).single()).data.content, oldMessage.content);
    assert.equal((await c.sdk.rpc('get_conversation', { p_request_id: own.data.id }).single()).data.can_send, false);
    assert.equal((await c.sdk.rpc('get_conversation', { p_request_id: again.data.id }).single()).data.can_send, true);
    const seenByAuthor = (await a.sdk.rpc('list_received_join_requests')).data.find(row => row.id === own.data.id);
    assert.equal(seenByAuthor.status, 'withdrawn');
  });
  await feature.step('decline → declined visible to both; withdraw afterwards refused', 'REMOTE', async () => {
    const created = await b.sdk.rpc('create_join_request', { p_post_id: declinePost.post.id, p_message: MESSAGE }).single();
    const declined = await a.sdk.rpc('decline_join_request', { p_request_id: created.data.id }).single();
    assert.equal(declined.data.status, 'declined');
    assert.equal((await b.sdk.rpc('list_sent_join_requests')).data.find(row => row.id === created.data.id).status, 'declined');
    assert.equal(expectError(await b.sdk.rpc('withdraw_join_request', { p_request_id: created.data.id }), 'withdraw declined').message, 'invalid_transition');
    assert.equal(expectError(await b.sdk.rpc('create_join_request', { p_post_id: declinePost.post.id, p_message: MESSAGE }), 'reapply declined').message, 'request_declined_history');
  });
  await feature.step('partner gender condition is enforced by the server (gender stays private)', 'REMOTE', async () => {
    const maleOnly = await createPost(ctx, a, '남성조건', { partnerGender: 'male' });
    assert.equal(maleOnly.post.partner_gender, 'male');
    assert.equal(expectError(await c.sdk.rpc('create_join_request', { p_post_id: maleOnly.post.id, p_message: MESSAGE }), 'female to male-only').message, 'partner_condition_mismatch');
    assert.deepEqual((await c.sdk.from('join_requests').select('id').eq('post_id', maleOnly.post.id)).data, []);
    const ok = await b.sdk.rpc('create_join_request', { p_post_id: maleOnly.post.id, p_message: MESSAGE }).single();
    assert.equal(ok.error, null, ok.error?.message);
    assert.deepEqual((await a.sdk.from('profiles').select('gender').eq('id', b.userId)).data, [], 'other members cannot read gender');
    const lists = JSON.stringify([(await a.sdk.rpc('list_received_join_requests')).data, (await b.sdk.rpc('get_request_counterpart_profile', { p_request_id: ok.data.id })).data]);
    assert.ok(!lists.includes('gender') && !lists.includes('"male"'));
  });
  await feature.step('direct REST insert/update on join_requests is refused', 'REMOTE', async () => {
    expectError(await b.sdk.from('join_requests').insert({ post_id: postA.post.id, requester_id: b.userId, message: MESSAGE }), 'direct insert');
    expectError(await a.sdk.from('join_requests').update({ status: 'declined' }).eq('id', request.id), 'direct update');
    assert.equal((await b.sdk.from('join_requests').select('status').eq('id', request.id).single()).data.status, 'pending');
  });
}

standalone(import.meta.url, 'feature-05-requests', feature05);
