// A/B/C full cycle in real browsers on the EXISTING app screens (normal run, Supabase data):
// login → posts → profile → request → realtime chat → final match → completion → blind reviews → reload/relogin → C/anon denial.
import assert from 'node:assert/strict';
import { anonClient, PERSONAS } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';
import { sleep } from './helpers/data.mjs';
import { ensureAppServer, inPage, launchBrowser, newMemberPage, pageUserId, uiLogin } from './helpers/browser.mjs';
import { ageOn } from '../../src/utils/profile.ts';
import { maskRealName } from '../../src/utils/maskName.ts';

const seoulParts = date => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
};

/** Existing "새 1:1 동행 모집하기" form (variant A). */
async function createPostInUi(member, { title, category, start, end, area, exact }) {
  const { page } = member;
  await page.locator('#nav-tab-home').click();
  await page.locator('#btn-fab-create').click();
  const dialog = page.getByRole('dialog', { name: '동행 공고 작성' });
  await dialog.getByRole('radio', { name: category, exact: true }).click();
  await dialog.locator('#meetup-title').fill(title);
  await dialog.locator('#meetup-description').fill('하네스 전체 사이클 검증 공고입니다.');
  const s = seoulParts(start), e = seoulParts(end);
  await dialog.locator('#meetup-start-date').fill(s.date);
  await dialog.locator('#meetup-start-time').fill(s.time);
  await dialog.locator('#meetup-end-date').fill(e.date);
  await dialog.locator('#meetup-end-time').fill(e.time);
  assert.equal(await dialog.getByLabel('공개 랜드마크').count(), 0, 'landmark field must not be collected in normal runs');
  await dialog.locator('#meetup-location').fill(area);
  await dialog.locator('#meetup-secret-location').fill(exact);
  await dialog.getByRole('button', { name: '1:1 동행 등록 완료' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 20000 });
}

async function openPostFromExplore(member, title) {
  const { page } = member;
  await page.locator('#nav-tab-explore').click();
  await page.getByLabel('공고 검색').fill(title.replace(/^\[/, ''));
  const card = page.getByRole('button', { name: new RegExp(title.replace(/[[\]]/g, '\\$&')) }).first();
  await card.waitFor({ timeout: 30000 });
  await card.click();
  return page.getByRole('dialog', { name: '동행 공고 상세' });
}

async function openRoom(member, requestId) {
  const { page } = member;
  await page.locator('#nav-tab-chat').click();
  const back = page.getByRole('button', { name: '채팅 목록으로' });
  if (await back.isVisible().catch(() => false)) await back.click();
  const room = page.locator(`[data-room-id="room-${requestId}"]`);
  await room.waitFor({ timeout: 30000 });
  await room.click();
  await page.getByRole('region', { name: '동행 대화방' }).or(page.getByLabel('동행 대화방')).first().waitFor();
}

/** Navigation can be aborted by an in-app route change at the same moment; retry once. */
async function gotoApp(page, url) {
  try { await page.goto(url); } catch (error) {
    if (!/ERR_ABORTED/.test(String(error))) throw error;
    await page.waitForTimeout(500);
    await page.goto(url);
  }
}

async function waitForCompletionButton(member) {
  try {
    await member.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '내 동행 완료 확인' && !b.disabled), null, { timeout: 40000 });
  } catch {
    const info = await member.page.evaluate(() => ({
      url: location.pathname + location.search,
      buttons: [...document.querySelectorAll('button')].filter(b => b.textContent.includes('완료')).map(b => ({ text: b.textContent, disabled: b.disabled })),
      reason: document.querySelector('[aria-label="동행 완료와 평가"] p')?.textContent || null,
      room: document.querySelector('[data-active-room]')?.getAttribute('data-active-room') || null,
    }));
    if (process.env.HARNESS_DEBUG_DIR) await member.page.screenshot({ path: `${process.env.HARNESS_DEBUG_DIR}/complete-${member.label}.png` });
    throw new Error(`completion button not enabled for ${member.label}: ${JSON.stringify(info)}`);
  }
}

async function sendChat(member, text) {
  const { page } = member;
  const box = page.getByLabel('메시지', { exact: true });
  await box.fill(text);
  const button = page.getByRole('button', { name: '메시지 보내기' });
  try {
    await button.click({ timeout: 8000 });
  } catch (error) {
    const state = {
      canSend: await button.count(), value: await box.inputValue().catch(() => 'n/a'), readOnly: await page.getByText('새 메시지는 보낼 수 없어요').count(),
      disabled: await button.isDisabled().catch(() => 'n/a'), box: await button.boundingBox().catch(() => null),
      viewport: page.viewportSize(), top: await page.evaluate(() => { const b = document.querySelector('[aria-label="메시지 보내기"]'); if (!b) return null; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { tag: el?.tagName, label: el?.getAttribute('aria-label') || el?.closest('[aria-label]')?.getAttribute('aria-label'), y: r.y }; }),
    };
    if (process.env.HARNESS_DEBUG_DIR) await page.screenshot({ path: `${process.env.HARNESS_DEBUG_DIR}/send-${member.label}.png` });
    throw new Error(`send failed for ${member.label}: ${JSON.stringify(state)}`);
  }
}

export async function fullCycle(ctx, feature) {
  const runId = ctx.run.runId;
  const exactA = `성수역 3번 출구 앞 하네스 ${runId}`;
  const exactB = `연남동 경의선숲길 입구 하네스 ${runId}`;
  const commentA = `A 평가 한마디 ${runId}`;
  const commentB = `B 평가 한마디 ${runId}`;
  ctx.run.guard.protect(exactA, exactB, ...Object.values(PERSONAS).flatMap(p => [p.realName, p.birthDate, p.phone]));
  for (const name of ['A', 'B', 'C']) await ctx.member(name);

  const server = await ensureAppServer();
  const browser = await launchBrowser();
  const titleA = `[${runId}] A 전체사이클 공고`;
  const titleB = `[${runId}] B 전체사이클 공고`;
  let A, B, C, anon, ids = {}, schedule;
  try {
    await feature.step('1. existing home renders; A, B, C log in in separate browser contexts', 'BROWSER', async () => {
      [A, B, C, anon] = await Promise.all(['A', 'B', 'C', 'anon'].map(name => newMemberPage(browser, server.url, name)));
      await anon.page.getByText('어떤 동행을 찾고 계신가요?').or(anon.page.locator('#nav-tab-home')).first().waitFor();
      assert.equal(await anon.page.getByText('체험 설정').count(), 0, 'normal run must not show the demo panel');
      for (const [member, name] of [[A, 'A'], [B, 'B'], [C, 'C']]) await uiLogin(member, PERSONAS[name].phone);
      for (const [member, name] of [[A, 'A'], [B, 'B']])
        await member.page.locator('header').getByText(`${maskRealName(PERSONAS[name].realName)} · ${ageOn(PERSONAS[name].birthDate)}살`).waitFor();
      ids.A = await pageUserId(A); ids.B = await pageUserId(B); ids.C = await pageUserId(C);
      assert.equal(new Set([ids.A, ids.B, ids.C]).size, 3);
    });

    await feature.step('2. A and B create posts in the existing form (시·구·동 + private place) and see each other', 'BROWSER', async () => {
      const start = new Date(Date.now() + 6 * 60_000); start.setSeconds(0, 0);
      schedule = { start, end: new Date(start.getTime() + 60_000) };
      await createPostInUi(A, { title: titleA, category: '전시', start: schedule.start, end: schedule.end, area: '서울특별시 성동구 성수동', exact: exactA });
      const far = new Date(Date.now() + 5 * 24 * 3600_000); far.setMinutes(0, 0, 0);
      await createPostInUi(B, { title: titleB, category: '산책', start: far, end: new Date(far.getTime() + 3600_000), area: '서울특별시 마포구 연남동', exact: exactB });
      ids.postA = await inPage(A, async (supabase, title) => (await supabase.from('posts').select('id').eq('title', title).single()).data.id, titleA);
      for (const [member, title] of [[A, titleB], [B, titleA]]) {
        const detail = await openPostFromExplore(member, title);
        await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
      }
    });

    await feature.step('3. detail shows 시·구·동 only; B and anon never receive the exact place', 'BROWSER', async () => {
      await gotoApp(anon.page, server.url); // a visitor opening the app after the post exists
      for (const member of [B, anon]) {
        const detail = await openPostFromExplore(member, titleA);
        await detail.getByText('서울특별시 성동구 성수동').first().waitFor();
        assert.ok(!(await member.page.content()).includes(exactA), `${member.label} page contains exact place`);
        await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
      }
    });

    await feature.step('4. B sees A as masked real name + full age; anon is asked to log in', 'BROWSER', async () => {
      const detail = await openPostFromExplore(B, titleA);
      const masked = maskRealName(PERSONAS.A.realName);
      await detail.getByRole('button', { name: `${masked}님의 상세 프로필 보기` }).click();
      const profile = B.page.getByRole('dialog', { name: `${masked}님의 상세 프로필` });
      await profile.getByText(`${ageOn(PERSONAS.A.birthDate)}살`).waitFor({ timeout: 20000 });
      const html = await B.page.content();
      assert.ok(!html.includes(PERSONAS.A.realName) && !html.includes(PERSONAS.A.birthDate));
      await B.page.keyboard.press('Escape');
      await gotoApp(B.page, server.url);
      const anonDetail = await openPostFromExplore(anon, titleA);
      await anonDetail.getByRole('button', { name: /님의 상세 프로필 보기/ }).click();
      await anon.page.getByRole('dialog', { name: '로그인' }).waitFor();
      await gotoApp(anon.page, server.url);
    });

    await feature.step('5. B requests A post once through the existing request modal; repeat is blocked', 'BROWSER', async () => {
      const detail = await openPostFromExplore(B, titleA);
      await detail.getByRole('button', { name: '1:1 동행 참여 신청하기' }).click();
      const modal = B.page.getByRole('dialog', { name: '동행 참여 신청' });
      await modal.locator('textarea').fill('안녕하세요, 전시를 함께 보고 싶어요!');
      await modal.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
      await modal.waitFor({ state: 'detached', timeout: 20000 });
      const again = await inPage(B, async (supabase, postId) => (await supabase.rpc('create_join_request', { p_post_id: postId, p_message: '두 번째 요청을 보내 봅니다.' }).single()).data, ids.postA);
      assert.equal(again.already_existed, true);
      ids.request = again.id;
      assert.equal(await inPage(B, async (supabase, postId) => (await supabase.from('join_requests').select('id').eq('post_id', postId)).data.length, ids.postA), 1);
    });

    await feature.step('6. A and B exchange messages in the existing chat room without reloading', 'BROWSER', async () => {
      await openRoom(B, ids.request);
      await openRoom(A, ids.request);
      await sleep(3000); // both Realtime channels join
      const fromB = `B→A 실시간 ${runId}`, fromA = `A→B 실시간 ${runId}`;
      await sendChat(B, fromB);
      let started = Date.now();
      await A.page.getByText(fromB).first().waitFor({ timeout: 25000 });
      const latencyBA = Date.now() - started;
      await sendChat(A, fromA);
      started = Date.now();
      await B.page.getByText(fromA).first().waitFor({ timeout: 25000 });
      return { latencyBtoAms: latencyBA, latencyAtoBms: Date.now() - started };
    });

    await feature.step('7. A accepts B in the chat room → server final match (post closed)', 'BROWSER', async () => {
      await A.page.getByRole('button', { name: '동행 수락하기' }).click();
      await A.page.waitForFunction(() => !document.body.innerText.includes('동행 수락하기'), null, { timeout: 25000 });
      const post = await inPage(A, async (supabase, id) => (await supabase.from('posts').select('status').eq('id', id).single()).data, ids.postA);
      assert.equal(post.status, 'closed');
      ids.appointment = await inPage(A, async (supabase, id) => (await supabase.rpc('get_conversation', { p_request_id: id }).single()).data.appointment_id, ids.request);
      assert.ok(ids.appointment);
    });

    await feature.step('8. only B newly sees the exact place; C still cannot', 'BROWSER', async () => {
      await B.page.getByRole('button', { name: '내 동행 완료 확인' }).waitFor({ timeout: 25000 });
      await B.page.getByRole('button', { name: new RegExp(titleA.replace(/[[\]]/g, '\\$&')) }).first().click();
      const detail = B.page.getByRole('dialog', { name: '동행 공고 상세' });
      await detail.getByText(exactA).waitFor({ timeout: 20000 });
      await detail.getByRole('button', { name: '공고 상세 닫기' }).click();
      assert.deepEqual(await inPage(C, async (supabase, id) => (await supabase.from('post_private_details').select('exact_location').eq('post_id', id)).data, ids.postA), []);
      assert.ok(!(await C.page.content()).includes(exactA));
    });

    await feature.step('9. completion before the end time is refused by the server', 'BROWSER', async () => {
      assert.ok(Date.now() < schedule.end.getTime(), 'schedule already ended; rerun');
      assert.equal(await A.page.getByRole('button', { name: '내 동행 완료 확인' }).isDisabled(), true);
      const early = await inPage(A, async (supabase, id) => (await supabase.rpc('confirm_appointment_completion', { p_appointment_id: id })).error?.message, ids.appointment);
      assert.equal(early, 'too_early');
      return { waitSecondsUntilEnd: Math.round((schedule.end.getTime() - Date.now()) / 1000) };
    });

    await feature.step('10. after the end time A confirms completion and immediately submits a review', 'BROWSER', async () => {
      await sleep(Math.max(0, schedule.end.getTime() - Date.now()) + 2000);
      const button = A.page.getByRole('button', { name: '내 동행 완료 확인' });
      await waitForCompletionButton(A);
      await button.click();
      const review = A.page.getByRole('dialog', { name: '동행 평가' });
      await review.waitFor({ timeout: 20000 });
      assert.equal(await review.getByText('좋았던 점').count(), 0, 'normal run stores rating + comment only');
      await review.getByRole('button', { name: '5점' }).click();
      await review.locator('textarea').fill(commentA);
      await review.getByRole('button', { name: '평가 제출하기' }).click();
      await review.getByText('내 평가를 제출했어요').waitFor({ timeout: 20000 });
      await review.getByRole('button', { name: '닫기', exact: true }).click();
    });

    await feature.step('11. B cannot see A’s rating or comment anywhere', 'BROWSER', async () => {
      await sleep(3000);
      assert.ok(!(await B.page.content()).includes(commentA));
      const state = await inPage(B, async (supabase, id) => (await supabase.rpc('get_appointment_review_state', { p_appointment_id: id }).single()).data, ids.appointment);
      assert.equal(state.peer_submitted, true);
      assert.equal(state.peer_review, null);
    });

    await feature.step('12. B confirms completion → appointment completed', 'BROWSER', async () => {
      await waitForCompletionButton(B);
      await B.page.getByRole('button', { name: '내 동행 완료 확인' }).click();
      await B.page.getByRole('dialog', { name: '동행 평가' }).waitFor({ timeout: 20000 });
      const row = await inPage(B, async (supabase, id) => (await supabase.from('appointments').select('status').eq('id', id).single()).data, ids.appointment);
      assert.equal(row.status, 'completed');
    });

    await feature.step('13–14. B reviews blind; then both see each other’s review', 'BROWSER', async () => {
      const review = B.page.getByRole('dialog', { name: '동행 평가' });
      assert.ok(!(await B.page.content()).includes(commentA), 'A comment visible before B submitted');
      await review.getByRole('button', { name: '4점' }).click();
      await review.locator('textarea').fill(commentB);
      await review.getByRole('button', { name: '평가 제출하기' }).click();
      await review.getByText(commentA).waitFor({ timeout: 25000 });
      await review.getByRole('button', { name: '닫기', exact: true }).click();
      await A.page.getByRole('button', { name: '공개된 후기 보기' }).first().waitFor({ timeout: 30000 });
      await A.page.getByRole('button', { name: '공개된 후기 보기' }).first().click();
      await A.page.getByRole('dialog', { name: '동행 평가' }).getByText(commentB).waitFor({ timeout: 20000 });
      await A.page.keyboard.press('Escape').catch(() => {});
    });

    await feature.step('15. state survives reload, logout and re-login (protected /me return, external next ignored)', 'BROWSER', async () => {
      await A.page.reload();
      await openRoom(A, ids.request);
      await A.page.getByRole('button', { name: '공개된 후기 보기' }).first().waitFor({ timeout: 30000 });
      await gotoApp(B.page, new URL('/me', server.url).toString());
      await B.page.getByRole('button', { name: /로그아웃/ }).first().click();
      await B.page.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor({ timeout: 20000 });
      assert.equal(await pageUserId(B), null);
      assert.ok(!(await B.page.content()).includes(commentA), 'private data remained after logout');
      await gotoApp(B.page, new URL('/me', server.url).toString());
      await B.page.waitForURL(/\/login\?next=%2Fme/);
      const login = B.page.getByRole('dialog', { name: '로그인', exact: true });
      await login.locator('#auth-phone').fill(PERSONAS.B.phone);
      await login.getByRole('button', { name: '인증번호 요청', exact: true }).click();
      await login.locator('#auth-otp').fill('123456');
      await login.getByRole('button', { name: 'Supabase에서 인증 확인', exact: true }).click();
      await B.page.waitForURL(url => new URL(url).pathname === '/me', { timeout: 20000 });
      await gotoApp(B.page, new URL('/login?next=https%3A%2F%2Fevil.example%2F', server.url).toString());
      await B.page.waitForURL(url => new URL(url).origin === new URL(server.url).origin && new URL(url).pathname !== '/login', { timeout: 20000 });
      assert.notEqual(new URL(B.page.url()).hostname, 'evil.example');
      await openRoom(B, ids.request);
      await B.page.getByRole('button', { name: '공개된 후기 보기' }).first().waitFor({ timeout: 30000 });
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
      assert.deepEqual(await inPage(C, probe, ids), { request: 0, chat: 0, appointment: 0, exact: 0, completion: 0, reviews: 'denied', reviewRpc: 'denied', conversationRpc: 'denied' });
      for (const [key, value] of Object.entries(await inPage(anon, probe, ids))) assert.ok(value === 0 || value === 'denied', `anon ${key}: ${value}`);
      assert.ok((await anonClient().from('appointment_reviews').select('id')).error);
      assert.ok(!(await C.page.content()).includes(commentA) && !(await C.page.content()).includes(commentB));
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
        .filter(text => !/Failed to load resource: the server responded with a status of 4\d\d/.test(text));
      assert.deepEqual(errors, []);
    });
  } finally {
    await browser.close();
    server.stop();
  }
}

standalone(import.meta.url, 'full-cycle', fullCycle);
