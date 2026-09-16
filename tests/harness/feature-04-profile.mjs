// Feature 4: safe author profile via post_id; raw profiles stay private.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonClient, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { createPost, DELETED_FIXTURE_POST_ID, expectError } from './helpers/data.mjs';
import { ageOn } from '../../src/utils/profile.ts';
import { maskRealName } from '../../src/utils/maskName.ts';

export async function feature04(ctx, feature) {
  const a = await ctx.member('A');
  const b = await ctx.member('B');
  const postA = ctx.shared.postA || await createPost(ctx, a, 'A공고');
  const postB = ctx.shared.postB || await createPost(ctx, b, 'B공고');
  const expected = name => ({ masked_name: maskRealName(PERSONAS[name].realName), age: ageOn(PERSONAS[name].birthDate) });

  await feature.step('B sees A as masked name + Seoul full age only (four keys)', 'REMOTE', async () => {
    const { data, error } = await b.sdk.rpc('get_post_author_profile', { p_post_id: postA.post.id }).single();
    assert.equal(error, null);
    assert.deepEqual(Object.keys(data).sort(), ['age', 'avatar_url', 'bio', 'masked_name']);
    assert.equal(data.masked_name, expected('A').masked_name);
    assert.equal(data.age, expected('A').age, 'server age equals ageOn() on the same Seoul date');
    const text = JSON.stringify(data);
    for (const leak of [PERSONAS.A.realName, PERSONAS.A.birthDate, PERSONAS.A.phone, a.userId]) assert.ok(!text.includes(leak));
    return { masked: data.masked_name, age: data.age, hasAvatar: Boolean(data.avatar_url), hasBio: Boolean(data.bio) };
  });
  await feature.step('A sees B the same way; null photo/bio come back as null, not an error', 'REMOTE', async () => {
    const { data, error } = await a.sdk.rpc('get_post_author_profile', { p_post_id: postB.post.id }).single();
    assert.equal(error, null);
    assert.equal(data.masked_name, expected('B').masked_name);
    assert.equal(data.age, expected('B').age);
    assert.ok(data.avatar_url === null || typeof data.avatar_url === 'string');
  });
  await feature.step('anon gets no profile data', 'REMOTE', async () => {
    expectError(await anonClient().rpc('get_post_author_profile', { p_post_id: postA.post.id }), 'anon profile');
  });
  await feature.step('deleted and unknown posts return the same generic error', 'REMOTE', async () => {
    const deleted = expectError(await b.sdk.rpc('get_post_author_profile', { p_post_id: DELETED_FIXTURE_POST_ID }), 'deleted');
    const unknown = expectError(await b.sdk.rpc('get_post_author_profile', { p_post_id: randomUUID() }), 'unknown');
    assert.equal(deleted.message, 'profile_unavailable');
    assert.equal(unknown.message, deleted.message);
  });
  await feature.step('A cannot read B raw profile directly; own raw birth date remains available to the owner', 'REMOTE', async () => {
    assert.deepEqual((await a.sdk.from('profiles').select('real_name,birth_date').eq('id', b.userId)).data, []);
    const own = await b.sdk.from('profiles').select('birth_date').eq('id', b.userId).single();
    assert.equal(own.data.birth_date, PERSONAS.B.birthDate);
  });
}

standalone(import.meta.url, 'feature-04-profile', feature04);
