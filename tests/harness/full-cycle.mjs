// A/B/C full cycle in real browsers against the remote project:
// login → posts → profile → request → realtime chat → final match → completion → blind reviews → reload/relogin → C/anon denial.
import assert from 'node:assert/strict';
import { anonClient, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { sleep } from './helpers/data.mjs';
import { ensureAppServer, inPage, launchBrowser, newMemberPage, pageUserId, seoulInputValue, uiLogin } from './helpers/browser.mjs';
import { ageOn } from '../../src/utils/profile.ts';
import { maskRealName } from '../../src/utils/maskName.ts';

async function createPostInUi(member, fields) {
  const { page } = member;
  await page.getByRole('button', { name: '동행 모집하기' }).click();
  const dialog = page.getByRole('dialog', { name: '동행 공고 작성' });
  await dialog.locator('input[name=title]').fill(fields.title);
  await dialog.locator('select[name=category]').selectOption(fields.category);
  await dialog.locator('textarea[name=description]').fill(fields.description);
  await dialog.locator('input[name=starts]').fill(fields.starts);
  await dialog.locator('input[name=ends]').fill(fields.ends);
  await dialog.locator('input[name=recruitment]').fill(fields.recruitment);
  await dialog.locator('input[name=publicArea]').fill(fields.publicArea);
  await dialog.locator('input[name=exactLocation]').fill(fields.exactLocation);
  await dialog.getByRole('button', { name: '공고 등록하기' }).click();
  await dialog.waitFor({ state: 'detached' });
  const detail = page.getByRole('dialog', { name: '공고 상세' });
  await detail.getByText(fields.title).waitFor();
  await detail.getByTestId('exact-location').waitFor(); // author sees own private place
  await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
}

/** Searches by the exact run title (other stages of the same run may fill the first 20-item page). */
async function searchTitle(member, title) {
  const { page } = member;
  await page.goto(new URL('/explore', page.url()).toString());
  await page.getByLabel('공고 검색').fill(title.replace(/^\[/, ''));
  await page.getByRole('button', { name: '검색', exact: true }).click();
  return page.getByRole('button', { name: new RegExp(title.replace(/[[\]]/g, '\\$&')) }).first();
}

async function openPostFromList(member, _runId, title) {
  await (await searchTitle(member, title)).click();
  return member.page.getByRole('dialog', { name: '공고 상세' });
}

export async function fullCycle(ctx, feature) {
  const runId = ctx.run.runId;
  const exactA = `성수역 3번 출구 앞 하네스 ${runId}`;
  const exactB = `연남동 경의선숲길 입구 하네스 ${runId}`;
  const commentA = `A 평가 한마디 ${runId}`;
  const commentB = `B 평가 한마디 ${runId}`;
  ctx.run.guard.protect(exactA, exactB, ...Object.values(PERSONAS).flatMap(p => [p.realName, p.birthDate, p.phone]));
  for (const name of ['A', 'B', 'C']) await ctx.member(name); // idempotent profile setup through API

  const server = await ensureAppServer();
  const browser = await launchBrowser();
  const titleA = `[${runId}] A 전체사이클 공고`;
  const titleB = `[${runId}] B 전체사이클 공고`;
  let A, B, C, anon, ids = {};
  try {
    await feature.step('1. A, B, C log in through the UI in separate browser contexts', 'BROWSER', async () => {
      [A, B, C] = await Promise.all(['A', 'B', 'C'].map(name => newMemberPage(browser, server.url, name)));
      anon = await newMemberPage(browser, server.url, 'anon');
      for (const [member, name] of [[A, 'A'], [B, 'B'], [C, 'C']]) await uiLogin(member, PERSONAS[name].phone);
      for (const [member, name] of [[A, 'A'], [B, 'B']]) {
        const expected = `${maskRealName(PERSONAS[name].realName)} · ${ageOn(PERSONAS[name].birthDate)}살`;
        await member.page.locator('header').getByText(expected).waitFor();
      }
      ids.A = await pageUserId(A); ids.B = await pageUserId(B); ids.C = await pageUserId(C);
      assert.equal(new Set([ids.A, ids.B, ids.C]).size, 3, 'sessions are independent');
    });

    let schedule;
    await feature.step('2. A and B create posts in the UI (exact place required) and see each other in the list', 'BROWSER', async () => {
      const start = new Date(Date.now() + 6 * 60_000);
      start.setSeconds(0, 0);
      schedule = { start, end: new Date(start.getTime() + 60_000) };
      await createPostInUi(A, { title: titleA, category: '전시', description: '하네스 전체 사이클 검증 공고', starts: seoulInputValue(schedule.start), ends: seoulInputValue(schedule.end), recruitment: seoulInputValue(schedule.start), publicArea: '서울특별시 성동구 성수동', exactLocation: exactA });
      const far = new Date(Date.now() + 5 * 24 * 3600_000); far.setMinutes(0, 0, 0);
      await createPostInUi(B, { title: titleB, category: '산책', description: '하네스 전체 사이클 검증 공고', starts: seoulInputValue(far), ends: seoulInputValue(new Date(far.getTime() + 3600_000)), recruitment: seoulInputValue(new Date(far.getTime() - 3600_000)), publicArea: '서울특별시 마포구 연남동', exactLocation: exactB });
      ids.postA = await inPage(A, async (supabase, title) => (await supabase.from('posts').select('id').eq('title', title).single()).data.id, titleA);
      ids.postB = await inPage(B, async (supabase, title) => (await supabase.from('posts').select('id').eq('title', title).single()).data.id, titleB);
      for (const member of [A, B]) for (const title of [titleA, titleB]) await (await searchTitle(member, title)).waitFor();
    });

    await feature.step('3. list and detail show 시·구·동 only, never the exact place (B and anon)', 'BROWSER', async () => {
      for (const member of [B, anon]) {
        const detail = await openPostFromList(member, runId, titleA);
        await detail.getByTestId('public-area').getByText('서울특별시 성동구 성수동').waitFor();
        await detail.getByTestId('exact-location-hidden').waitFor();
        assert.ok(!(await member.page.content()).includes(exactA), `${member.label} page contains exact place`);
        await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
      }
    });

    await feature.step('4. B sees A as masked real name + full age; anon is asked to log in', 'BROWSER', async () => {
      const detail = await openPostFromList(B, runId, titleA);
      await detail.getByRole('button', { name: '작성자 프로필 보기' }).click();
      const profile = B.page.getByRole('dialog', { name: '작성자 프로필' });
      await profile.getByTestId('masked-name').getByText(maskRealName(PERSONAS.A.realName), { exact: true }).waitFor();
      await profile.getByTestId('public-age').getByText(`${ageOn(PERSONAS.A.birthDate)}살`, { exact: true }).waitFor();
      const html = await B.page.content();
      assert.ok(!html.includes(PERSONAS.A.realName) && !html.includes(PERSONAS.A.birthDate));
      await profile.getByRole('button', { name: '공고로 돌아가기' }).click();
      await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
      const anonDetail = await openPostFromList(anon, runId, titleA);
      await anonDetail.getByRole('button', { name: '작성자 프로필 보기' }).click();
      await anon.page.getByRole('dialog', { name: '로그인' }).waitFor();
      await anon.page.getByRole('button', { name: '로그인 창 닫기' }).click();
      await anon.page.goto(server.url);
    });

    await feature.step('5. B requests A post once; a repeated request is blocked', 'BROWSER', async () => {
      const detail = await openPostFromList(B, runId, titleA);
      await detail.getByRole('button', { name: '참여 요청하기' }).click();
      await detail.locator('#join-message').fill('안녕하세요, 전시를 함께 보고 싶어요!');
      await detail.getByRole('button', { name: '참여 요청 보내기' }).click();
      await detail.getByTestId('my-request-status').getByText('매칭 대화 중').waitFor();
      const again = await inPage(B, async (supabase, postId) => (await supabase.rpc('create_join_request', { p_post_id: postId, p_message: '두 번째 요청을 보내 봅니다.' }).single()).data, ids.postA);
      assert.equal(again.already_existed, true);
      ids.request = again.id;
      const count = await inPage(B, async (supabase, postId) => (await supabase.from('join_requests').select('id').eq('post_id', postId)).data.length, ids.postA);
      assert.equal(count, 1);
      await detail.getByRole('button', { name: '신청 대화 열기' }).click();
      await B.page.getByTestId('request-status').getByText('매칭 대화 중').waitFor();
    });

    await feature.step('6. A and B exchange messages in both directions without reloading', 'BROWSER', async () => {
      await A.page.goto(new URL(`/chat?room=${ids.request}`, server.url).toString());
      await A.page.getByTestId('chat-counterpart').getByText(maskRealName(PERSONAS.B.realName)).waitFor();
      // Send only after both screens report a live database listener (the app also re-reads on ready).
      for (const member of [A, B]) await member.page.locator('section[aria-label="매칭 대화"][data-realtime="ready"]').waitFor({ timeout: 20000 });
      const fromB = `B→A 실시간 ${runId}`;
      const fromA = `A→B 실시간 ${runId}`;
      await B.page.locator('#chat-input').fill(fromB);
      await B.page.getByRole('button', { name: '메시지 보내기' }).click();
      const started = Date.now();
      await A.page.getByRole('log').getByText(fromB).waitFor({ timeout: 20000 });
      const latencyBA = Date.now() - started;
      await A.page.locator('#chat-input').fill(fromA);
      await A.page.getByRole('button', { name: '메시지 보내기' }).click();
      const started2 = Date.now();
      await B.page.getByRole('log').getByText(fromA).waitFor({ timeout: 20000 });
      return { latencyBtoAms: latencyBA, latencyAtoBms: Date.now() - started2 };
    });

    await feature.step('7. A confirms B as the final companion (UI shows the stored exact place to the author)', 'BROWSER', async () => {
      await A.page.getByRole('button', { name: '이 신청자와 동행 확정' }).click();
      const sheet = A.page.getByRole('dialog', { name: '동행 확정' });
      await sheet.getByText(exactA).waitFor();
      await sheet.getByText('확정하면 다른 신청은 종료됩니다.').waitFor();
      await sheet.getByRole('button', { name: '최종 동행 확정' }).click();
      await sheet.waitFor({ state: 'detached' });
      await A.page.getByTestId('request-status').getByText('동행 확정').waitFor();
      const post = await inPage(A, async (supabase, id) => (await supabase.from('posts').select('status').eq('id', id).single()).data, ids.postA);
      assert.equal(post.status, 'closed');
    });

    await feature.step('8. only B newly sees the exact place; C still cannot', 'BROWSER', async () => {
      await B.page.getByTestId('request-status').getByText('동행 확정').waitFor({ timeout: 20000 });
      await B.page.getByTestId('appointment-exact-location').getByText(exactA).waitFor();
      ids.appointment = await inPage(B, async (supabase, id) => (await supabase.rpc('get_conversation', { p_request_id: id }).single()).data.appointment_id, ids.request);
      // A's post is closed now, so it has left the default list; C checks the private row with its own session.
      const cRead = await inPage(C, async (supabase, id) => (await supabase.from('post_private_details').select('exact_location').eq('post_id', id)).data, ids.postA);
      assert.deepEqual(cRead, []);
      assert.ok(!(await C.page.content()).includes(exactA));
    });

    await feature.step('9. completion before the end time is refused by the server', 'BROWSER', async () => {
      assert.ok(Date.now() < schedule.end.getTime(), 'schedule already ended; rerun');
      await A.page.getByRole('button', { name: '내 동행 완료 확인' }).waitFor();
      assert.equal(await A.page.getByRole('button', { name: '내 동행 완료 확인' }).isDisabled(), true);
      const early = await inPage(A, async (supabase, id) => (await supabase.rpc('confirm_appointment_completion', { p_appointment_id: id })).error?.message, ids.appointment);
      assert.equal(early, 'too_early');
      return { waitSecondsUntilEnd: Math.round((schedule.end.getTime() - Date.now()) / 1000) };
    });

    await feature.step('10. after the end time A confirms completion and immediately submits a review', 'BROWSER', async () => {
      await sleep(Math.max(0, schedule.end.getTime() - Date.now()) + 3000);
      const button = A.page.getByRole('button', { name: '내 동행 완료 확인' });
      await A.page.waitForFunction(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent === '내 동행 완료 확인'); return el && !el.disabled; }, null, { timeout: 30000 });
      await button.click();
      await A.page.getByTestId('completion-status').getByText('내 완료 확인됨 · 상대 확인 대기').waitFor();
      const review = A.page.getByRole('region', { name: '상호 평가' });
      await review.getByRole('radio', { name: '5점' }).click();
      await review.locator('textarea[name=review-comment]').fill(commentA);
      await review.getByRole('button', { name: '평가 제출' }).click();
      await review.getByRole('button', { name: '확인하고 제출' }).click();
      await review.getByTestId('review-state').getByText('내 평가 제출 완료 · 상대 평가 대기').waitFor();
    });

    await feature.step('11. B only learns that A submitted — no rating or comment', 'BROWSER', async () => {
      await B.page.getByTestId('peer-submitted').waitFor({ timeout: 20000 });
      assert.ok(!(await B.page.content()).includes(commentA));
      const state = await inPage(B, async (supabase, id) => (await supabase.rpc('get_appointment_review_state', { p_appointment_id: id }).single()).data, ids.appointment);
      assert.equal(state.peer_submitted, true);
      assert.equal(state.peer_review, null);
      assert.ok(!JSON.stringify(state).includes(commentA));
    });

    await feature.step('12. B confirms completion → appointment completed on both screens', 'BROWSER', async () => {
      await B.page.getByRole('button', { name: '내 동행 완료 확인' }).click();
      await B.page.getByTestId('completion-status').getByText('동행 완료').waitFor();
      await A.page.getByTestId('completion-status').getByText('동행 완료').waitFor({ timeout: 20000 });
    });

    await feature.step('13–14. B reviews blind; then both see each other’s review', 'BROWSER', async () => {
      const review = B.page.getByRole('region', { name: '상호 평가' });
      assert.ok(!(await B.page.content()).includes(commentA), 'A comment visible before B submitted');
      await review.getByRole('radio', { name: '4점' }).click();
      await review.locator('textarea[name=review-comment]').fill(commentB);
      await review.getByRole('button', { name: '평가 제출' }).click();
      await review.getByRole('button', { name: '확인하고 제출' }).click();
      await review.getByTestId('peer-review-comment').getByText(commentA).waitFor();
      await A.page.getByTestId('peer-review-comment').getByText(commentB).waitFor({ timeout: 20000 });
    });

    await feature.step('15. state survives reload, logout and re-login (protected /me return, external next ignored)', 'BROWSER', async () => {
      await A.page.reload();
      await A.page.getByTestId('peer-review-comment').getByText(commentB).waitFor();
      await B.page.goto(new URL('/me', server.url).toString());
      await B.page.getByRole('button', { name: '로그아웃' }).click();
      await B.page.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor();
      assert.equal(await pageUserId(B), null);
      assert.ok(!(await B.page.content()).includes(commentA), 'private data remained after logout');
      // Protected path → login → return to the requested internal path.
      await B.page.goto(new URL('/me', server.url).toString());
      await B.page.waitForURL(/\/login\?next=%2Fme/);
      const login = B.page.getByRole('dialog', { name: '로그인', exact: true });
      await login.locator('#auth-phone').fill(PERSONAS.B.phone);
      await login.getByRole('button', { name: '인증번호 요청', exact: true }).click();
      await login.locator('#auth-otp').fill('123456');
      await login.getByRole('button', { name: 'Supabase에서 인증 확인', exact: true }).click();
      await B.page.waitForURL(url => new URL(url).pathname === '/me');
      await B.page.getByTestId('me-masked-name').waitFor();
      // A manipulated external `next` is ignored.
      await B.page.goto(new URL('/login?next=https%3A%2F%2Fevil.example%2F', server.url).toString());
      await B.page.waitForURL(url => new URL(url).origin === new URL(server.url).origin && new URL(url).pathname === '/');
      await B.page.goto(new URL(`/chat?room=${ids.request}`, server.url).toString());
      await B.page.getByTestId('completion-status').getByText('동행 완료').waitFor();
      await B.page.getByTestId('peer-review-comment').getByText(commentA).waitFor();
    });

    await feature.step('16. C and anon cannot read the request, chat, appointment, exact place, completion or reviews', 'BROWSER', async () => {
      const probe = async (supabase, ids) => {
        const rows = async query => { const { data, error } = await query; return error ? 'denied' : data.length; };
        return {
          request: await rows(supabase.from('join_requests').select('id').eq('id', ids.request)),
          chat: await rows(supabase.from('chat_messages').select('id').eq('join_request_id', ids.request)),
          appointment: await rows(supabase.from('appointments').select('id').eq('id', ids.appointment)),
          exact: await rows(supabase.from('post_private_details').select('post_id').eq('post_id', ids.postA)),
          completion: await rows(supabase.from('appointment_completion_confirmations').select('user_id').eq('appointment_id', ids.appointment)),
          reviews: await rows(supabase.from('appointment_reviews').select('id').eq('appointment_id', ids.appointment)),
          reviewRpc: (await supabase.rpc('get_appointment_review_state', { p_appointment_id: ids.appointment })).error ? 'denied' : 'allowed',
          conversationRpc: (await supabase.rpc('get_conversation', { p_request_id: ids.request })).error ? 'denied' : 'allowed',
        };
      };
      const expected = { request: 0, chat: 0, appointment: 0, exact: 0, completion: 0, reviews: 'denied', reviewRpc: 'denied', conversationRpc: 'denied' };
      assert.deepEqual(await inPage(C, probe, ids), expected);
      const anonResult = await inPage(anon, probe, ids);
      for (const [key, value] of Object.entries(anonResult)) assert.ok(value === 0 || value === 'denied', `anon ${key}: ${value}`);
      // Independent of the browser: plain anon REST client.
      const rest = anonClient();
      assert.ok((await rest.from('appointment_reviews').select('id')).error);
      return { C: 'all denied', anon: 'all denied' };
    });

    await feature.step('17. A and B cannot read each other’s raw real name, birth date or phone', 'BROWSER', async () => {
      const readOther = async (supabase, otherId) => (await supabase.from('profiles').select('real_name,birth_date').eq('id', otherId)).data;
      assert.deepEqual(await inPage(A, readOther, ids.B), []);
      assert.deepEqual(await inPage(B, readOther, ids.A), []);
      for (const [member, other] of [[A, 'B'], [B, 'A']]) {
        const html = await member.page.content();
        for (const leak of [PERSONAS[other].realName, PERSONAS[other].birthDate, PERSONAS[other].phone]) assert.ok(!html.includes(leak));
      }
    });

    await feature.step('no uncaught page errors in A/B/C/anon browsers', 'BROWSER', async () => {
      const errors = [A, B, C, anon].flatMap(member => member.consoleErrors.map(text => `${member.label}: ${text}`))
        .filter(text => !/Failed to load resource: the server responded with a status of 4\d\d/.test(text)); // expected denials in step 16
      assert.deepEqual(errors, []);
    });
  } finally {
    await browser.close();
    server.stop();
  }
}

standalone(import.meta.url, 'full-cycle', fullCycle);
