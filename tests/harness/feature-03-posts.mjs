// Feature 3: atomic post creation, public list/detail, filters, pagination, private exact location.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonClient } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { createPost, DELETED_FIXTURE_POST_ID, expectError, sleep } from './helpers/data.mjs';

export async function feature03(ctx, feature) {
  const anon = anonClient();
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const c = await ctx.member('C');
  const runQuery = ctx.run.runId;
  let postA, postB;

  await feature.step('anon cannot create posts', 'REMOTE', async () => {
    const result = await anon.rpc('create_post', { p_post_id: randomUUID(), p_title: 'x', p_description: 'x', p_category: '산책', p_starts_at: new Date().toISOString(), p_ends_at: new Date().toISOString(), p_recruitment_ends_at: new Date().toISOString(), p_public_area: '서울특별시 성동구 성수동', p_exact_location: '비공개' });
    expectError(result, 'anon create_post');
  });
  await feature.step('A and B each create a post; author comes from the session; response has no exact location', 'REMOTE', async () => {
    postA = await createPost(ctx, a, 'A공고', { category: '전시', publicArea: '서울특별시 성동구 성수동' });
    postB = await createPost(ctx, b, 'B공고', { category: '산책', publicArea: '서울특별시 마포구 연남동', startsInSeconds: 4 * 24 * 3600 });
    assert.equal(postA.post.author_id, a.userId);
    assert.equal(postB.post.author_id, b.userId);
    assert.equal(postA.post.capacity, 2);
    assert.equal(postA.post.status, 'recruiting');
    assert.ok(!('exact_location' in postA.post));
    assert.ok(!JSON.stringify(postA.post).includes(postA.exactLocation));
    ctx.shared.postA = postA; ctx.shared.postB = postB;
    return { postA: postA.post.id, postB: postB.post.id };
  });
  await feature.step('retrying the same submit returns the same post; another member cannot reuse the id', 'REMOTE', async () => {
    const retry = await a.sdk.rpc('create_post', postA.args);
    assert.equal(retry.error, null);
    assert.equal(retry.data.id, postA.post.id);
    const hijack = await b.sdk.rpc('create_post', { ...postA.args, p_title: '[탈취] 다른 사람 공고' });
    expectError(hijack, 'reuse of another author post id');
    const rows = await anon.from('posts').select('id').eq('id', postA.post.id);
    assert.equal(rows.data.length, 1);
  });
  await feature.step('invalid input is rejected and leaves no partial post/private row', 'REMOTE', async () => {
    const cases = {
      stationInPublicArea: { p_public_area: '서울특별시 성동구 성수역 3번 출구' },
      shortExactLocation: { p_exact_location: '가' },
      recruitmentInPast: { p_recruitment_ends_at: new Date(Date.now() - 60_000).toISOString() },
      startsAfterEnds: { p_ends_at: postA.args.p_starts_at },
      unknownCategory: { p_category: '파티' },
      tooManyTags: { p_tags: ['1', '2', '3', '4', '5', '6'] },
      unknownPartnerGender: { p_partner_gender: 'other' },
    };
    for (const [name, override] of Object.entries(cases)) {
      const id = randomUUID();
      const result = await a.sdk.rpc('create_post', { ...postA.args, p_post_id: id, ...override });
      expectError(result, name);
      assert.deepEqual((await a.sdk.from('posts').select('id').eq('id', id)).data, [], `${name} left a post`);
      assert.deepEqual((await a.sdk.from('post_private_details').select('post_id').eq('post_id', id)).data, [], `${name} left a private row`);
    }
    return { rejected: Object.keys(cases) };
  });
  await feature.step('anon, A and B see the same public list and detail without exact location', 'REMOTE', async () => {
    const lists = await Promise.all([anon, a.sdk, b.sdk].map(client => client.rpc('list_posts', { p_query: runQuery })));
    for (const list of lists) {
      assert.equal(list.error, null);
      assert.deepEqual(list.data.map(row => row.id).sort(), [postA.post.id, postB.post.id].sort());
      assert.ok(!JSON.stringify(list.data).includes('하네스 비공개 장소'));
    }
    const detail = await anon.from('posts').select('*').eq('id', postB.post.id).single();
    assert.equal(detail.error, null);
    assert.ok(!('exact_location' in detail.data));
    const window = await anon.rpc('post_request_window', { p_post_id: postB.post.id }).single();
    assert.equal(window.data.accepting_requests, true);
  });
  await feature.step('search, date, category and public-area filters match server rows', 'REMOTE', async () => {
    const seoulDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
    const ids = async args => (await anon.rpc('list_posts', { p_query: runQuery, ...args })).data.map(row => row.id);
    assert.deepEqual(await ids({ p_category: '전시' }), [postA.post.id]);
    assert.deepEqual(await ids({ p_area: '서울특별시 마포구' }), [postB.post.id]);
    assert.deepEqual(await ids({ p_date: seoulDate(postA.post.starts_at) }), [postA.post.id]);
    assert.deepEqual(await ids({ p_category: '공연' }), []);
    assert.deepEqual((await anon.rpc('list_posts', { p_query: `${runQuery}] B공고` })).data.map(row => row.id), [postB.post.id]);
    assert.deepEqual(await ids({ p_area: '%' }), [], 'wildcards are escaped');
  });
  await feature.step('keyset pagination has no duplicates or gaps (page size 1 over run posts)', 'REMOTE', async () => {
    const seen = [];
    let cursor = {};
    for (let page = 0; page < 5; page++) {
      const { data } = await anon.rpc('list_posts', { p_query: runQuery, p_limit: 1, ...cursor });
      if (!data.length) break;
      seen.push(data[0].id);
      cursor = { p_after_starts_at: data[0].starts_at, p_after_id: data[0].id };
    }
    assert.deepEqual(seen, [postA.post.id, postB.post.id], 'ordered by starts_at then id');
  });
  await feature.step('deleted posts are hidden from list and direct id lookup', 'REMOTE', async () => {
    for (const client of [anon, a.sdk]) {
      assert.deepEqual((await client.from('posts').select('id').eq('id', DELETED_FIXTURE_POST_ID)).data, []);
      assert.ok(!(await client.rpc('list_posts', { p_query: '삭제 상태 공고' })).data.some(row => row.id === DELETED_FIXTURE_POST_ID));
    }
  });
  await feature.step('recruitment-closed post leaves the default list but its detail still opens as closed (server time)', 'REMOTE', async () => {
    const closing = await createPost(ctx, c, '마감예정', { recruitmentLeadSeconds: 4 });
    await sleep(6000);
    const list = await anon.rpc('list_posts', { p_query: runQuery });
    assert.ok(!list.data.some(row => row.id === closing.post.id));
    const detail = await anon.from('posts').select('id,status').eq('id', closing.post.id).single();
    assert.equal(detail.data.id, closing.post.id);
    const window = await anon.rpc('post_request_window', { p_post_id: closing.post.id }).single();
    assert.equal(window.data.accepting_requests, false);
    ctx.shared.closedPost = closing;
  });
  await feature.step('exact location: author reads own; other members and anon cannot', 'REMOTE', async () => {
    const own = await a.sdk.from('post_private_details').select('exact_location').eq('post_id', postA.post.id).single();
    assert.equal(own.error, null);
    assert.equal(own.data.exact_location, postA.exactLocation);
    assert.deepEqual((await b.sdk.from('post_private_details').select('*').eq('post_id', postA.post.id)).data, []);
    assert.deepEqual((await c.sdk.from('post_private_details').select('*')).data.filter(row => row.post_id === postA.post.id), []);
    const anonRead = await anon.from('post_private_details').select('*').eq('post_id', postA.post.id);
    assert.ok(anonRead.error || anonRead.data.length === 0);
  });
  await feature.step('direct REST writes to posts/private details are refused', 'REMOTE', async () => {
    expectError(await a.sdk.from('posts').insert({ author_id: a.userId, title: '직접삽입', description: 'x', category: '산책', starts_at: postA.args.p_starts_at, ends_at: postA.args.p_ends_at, recruitment_ends_at: postA.args.p_recruitment_ends_at, public_area: '서울특별시 성동구 성수동' }), 'direct insert');
    const update = await a.sdk.from('posts').update({ status: 'closed' }).eq('id', postA.post.id).select();
    assert.ok(update.error || update.data.length === 0);
    expectError(await a.sdk.from('post_private_details').update({ exact_location: '변조' }).eq('post_id', postA.post.id).select(), 'private update');
    expectError(await anon.from('posts').delete().eq('id', postA.post.id), 'anon delete');
    const still = await anon.from('posts').select('status').eq('id', postA.post.id).single();
    assert.equal(still.data.status, 'recruiting');
  });
}

standalone(import.meta.url, 'feature-03-posts', feature03);
