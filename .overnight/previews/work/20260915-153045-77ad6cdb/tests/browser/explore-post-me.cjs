// Step 3 browser check: explore filters, event → related posts → create for that event, post form A/B,
// partner condition, re-consent, request → optional chat → host accept, Me status lists, close/delete/cancel.
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const url = process.env.CHECK_URL || 'http://127.0.0.1:4186/?demo=1';
const out = process.env.EVIDENCE_DIR || 'docs/overnight/evidence';
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const DEMO_KEY = 'yumidang:demo:v1';
const YUMI = 'user-demo-yumi';
const result = { url, mode: 'step-3 explore/post form/Me', cases: [], errors: [], externalRequests: [] };
const DAY = 86_400_000;
const kstKey = days => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + days * DAY));
const REGION_KEYWORDS = { jongno: ['종로구', '삼청', '소격', '안국'] };
const SAVED_FIELDS = ['category', 'description', 'startsAt', 'endsAt', 'recruitmentEndsAt', 'location', 'publicLocation', 'secretLocation', 'partnerGender', 'partnerPreferences', 'tags', 'eventId'];
const pick = post => Object.fromEntries(SAVED_FIELDS.map(key => [key, post[key]]));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  async function run(id, name, fn, viewport = { width: 390, height: 844 }) {
    if (process.env.CASE && process.env.CASE !== id) return;
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => result.errors.push(`${id}: ${error.message}`));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => {
      if (/supabase\.co|google-analytics|googletagmanager|generativelanguage/.test(request.url())) result.externalRequests.push(`${id}: ${request.url()}`);
    });
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const details = await fn(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
      result.cases.push({ id, name, status: 'PASS', details: details || '' });
    } catch (error) {
      result.cases.push({ id, name, status: 'FAIL', details: error.message });
      await page.screenshot({ path: `${out}/step3-failure-${id}.png` }).catch(() => {});
    } finally {
      await context.close();
      console.log(result.cases.at(-1));
    }
  }

  const panel = page => page.getByRole('region', { name: '체험 설정', exact: true });
  const togglePanel = async (page, open) => {
    const toggle = panel(page).getByRole('button', { name: /체험 설정/ });
    if ((await toggle.getAttribute('aria-expanded') === 'true') !== open) await toggle.click();
  };
  const asUser = async (page, id) => {
    await togglePanel(page, true);
    await panel(page).locator(`[data-demo-user="${id}"]`).click();
    await togglePanel(page, false);
  };
  const setFormVariant = async (page, value) => {
    await togglePanel(page, true);
    await panel(page).getByRole('radiogroup', { name: '04 공고 작성 안' }).getByRole('radio', { name: `${value}안` }).click();
    await togglePanel(page, false);
  };
  const nav = (page, id) => page.locator('#nav-tab-' + id).click();
  const stored = async page => JSON.parse(await page.evaluate(k => localStorage.getItem(k), DEMO_KEY) || 'null')?.data;
  async function until(page, predicate, label) {
    for (let i = 0; i < 50; i++) {
      const data = await stored(page);
      if (data && predicate(data)) return data;
      await page.waitForTimeout(100);
    }
    throw new Error(`stored state never matched: ${label}`);
  }
  const dismiss = async page => {
    const button = page.getByRole('button', { name: '안내 닫기' });
    if (await button.count()) await button.click();
  };
  const postDetail = page => page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
  const closeDetail = page => page.getByRole('button', { name: '공고 상세 닫기', exact: true }).click();
  const activity = page => page.getByRole('region', { name: '상태별 동행', exact: true });
  const openOwnPost = async (page, title) => {
    await nav(page, 'me');
    await page.getByRole('region', { name: '내가 쓴 공고' }).getByRole('button', { name: title }).click();
    return postDetail(page);
  };
  const requestCard = (page, id) => page.locator(`[data-request-id="${id}"]`);
  const startKeyOf = post => post.startsAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(post.startsAt)) : null;

  await run('E1', 'explore category/region/date filters, zero results, reset, return keeps filters', async page => {
    await nav(page, 'explore');
    const data = await until(page, d => d.posts.length > 0, 'seed');
    const listed = data.posts.filter(post => post.status !== 'deleted');
    const cards = page.locator('[aria-label="공고 목록"] [data-post-id]');
    const filters = page.getByRole('region', { name: '탐색 필터', exact: true });
    const summary = page.locator('[data-filter-summary]');
    assert.equal(await cards.count(), listed.length, 'unfiltered count');

    await filters.getByRole('group', { name: '카테고리' }).getByRole('button', { name: '전시', exact: true }).click();
    const exhibition = listed.filter(post => post.category === '전시');
    assert.ok(exhibition.length >= 2, 'seed has several exhibition posts');
    assert.equal(await cards.count(), exhibition.length);
    assert.deepEqual([...new Set(await cards.evaluateAll(els => els.map(el => el.dataset.category)))], ['전시']);
    assert.equal(await filters.getByRole('button', { name: '전시', exact: true }).getAttribute('aria-pressed'), 'true');

    await filters.getByLabel('지역', { exact: true }).selectOption('jongno');
    const jongno = exhibition.filter(post => REGION_KEYWORDS.jongno.some(k => `${post.location} ${post.publicLocation || ''}`.includes(k)));
    assert.equal(await cards.count(), jongno.length);
    assert.match(await summary.innerText(), /적용: 전시 · 종로구/);

    await filters.getByLabel('날짜', { exact: true }).selectOption('week');
    const today = kstKey(0), last = kstKey(6);
    const week = jongno.filter(post => startKeyOf(post) && startKeyOf(post) >= today && startKeyOf(post) <= last);
    assert.equal(await cards.count(), week.length, '7-day filter');

    await filters.getByLabel('날짜', { exact: true }).selectOption('date');
    await filters.getByLabel('날짜 선택', { exact: true }).fill(kstKey(400));
    const empty = page.locator('[data-empty-results]');
    await empty.waitFor();
    assert.equal(await cards.count(), 0);
    await page.screenshot({ path: `${out}/step3-explore-empty-mobile.png` });
    await empty.getByRole('button', { name: '필터 초기화' }).click();
    assert.equal(await cards.count(), listed.length, 'reset restores the full list');
    assert.match(await summary.innerText(), /적용된 필터 없음/);

    await filters.getByLabel('날짜', { exact: true }).selectOption('today');
    const todays = listed.filter(post => startKeyOf(post) === today);
    assert.equal(await cards.count(), todays.length, 'today filter');
    await filters.getByRole('button', { name: '필터 초기화' }).click();
    await filters.getByRole('group', { name: '카테고리' }).getByRole('button', { name: '지금', exact: true }).click();
    const nowCount = listed.filter(post => post.category === '지금').length;
    assert.equal(await cards.count(), nowCount);
    await page.screenshot({ path: `${out}/step3-explore-filter-mobile.png` });
    await cards.first().click();
    await postDetail(page).waitFor();
    await closeDetail(page);
    assert.equal(await cards.count(), nowCount, 'back from detail keeps the filter');
    await nav(page, 'home');
    await nav(page, 'explore');
    assert.equal(await filters.getByRole('button', { name: '지금', exact: true }).getAttribute('aria-pressed'), 'true', 'tab switch keeps the filter');
    // Empty-state "home" exit.
    await filters.getByLabel('공고 검색').fill('존재하지 않는 공고 제목');
    await empty.getByRole('button', { name: '홈으로 돌아가기' }).click();
    assert.equal(await page.locator('#btn-view-all-events').count(), 1, 'back on home');
    return `all ${listed.length}, 전시 ${exhibition.length}, +종로 ${jongno.length}, +7일 ${week.length}, 오늘 ${todays.length}, 지금 ${nowCount}`;
  });

  await run('E1D', 'explore filters at 1280×900 without horizontal overflow', async page => {
    await nav(page, 'explore');
    const filters = page.getByRole('region', { name: '탐색 필터', exact: true });
    await filters.getByRole('group', { name: '카테고리' }).getByRole('button', { name: '식사', exact: true }).click();
    await filters.getByLabel('지역', { exact: true }).selectOption('seongdong');
    const count = await page.locator('[aria-label="공고 목록"] [data-post-id]').count();
    await page.screenshot({ path: `${out}/step3-explore-desktop.png` });
    return `식사+성동 ${count}`;
  }, { width: 1280, height: 900 });

  await run('E2', 'event detail shows only its eventId posts; create from the event links the same eventId; ended event blocks creation', async page => {
    const data = await until(page, d => d.posts.length > 0, 'seed');
    const linked = data.posts.filter(post => post.eventId);
    assert.equal(linked.length, 2, 'two seeded event posts');
    const eventId = linked[0].eventId;
    assert.ok(linked.every(post => post.eventId === eventId));
    await asUser(page, YUMI);
    const carousel = page.locator('[data-testid="event-carousel"]');
    await carousel.locator(`[data-event-id="${eventId}"]`).click();
    const detail = page.getByRole('dialog', { name: '이벤트 상세', exact: true });
    const related = detail.getByRole('region', { name: '이 행사 관련 공고' });
    const relatedCards = related.locator('[data-post-id]');
    assert.equal(await relatedCards.count(), 2);
    assert.deepEqual([...new Set(await relatedCards.evaluateAll(els => els.map(el => el.dataset.eventId)))], [eventId]);
    await page.screenshot({ path: `${out}/step3-event-related-mobile.png` });

    await related.getByRole('button', { name: '이 행사로 동행 모집하기' }).click();
    const form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true });
    assert.equal(await form.locator('[data-linked-event]').getAttribute('data-linked-event'), eventId);
    await form.getByLabel('모집 제목').fill('E2 행사 연결 공고');
    await form.getByLabel('동행 상세 소개').fill('행사와 연결된 공고를 검증합니다.');
    await form.locator('button[type="submit"]').click();
    await form.waitFor({ state: 'detached' });
    const saved = await until(page, d => d.posts.some(post => post.title === 'E2 행사 연결 공고'), 'event post');
    const created = saved.posts.find(post => post.title === 'E2 행사 연결 공고');
    assert.equal(created.eventId, eventId);
    assert.equal(created.authorId, YUMI);
    assert.equal(created.status, 'recruiting');
    assert.equal(await relatedCards.count(), 3, 'new post appears in the same event list');
    await relatedCards.filter({ hasText: 'E2 행사 연결 공고' }).click();
    assert.match(await postDetail(page).innerText(), /연결 행사:/);
    await closeDetail(page);

    await detail.getByRole('button', { name: '뒤로가기' }).click();
    const otherId = (await carousel.locator('[data-event-id]').evaluateAll(els => els.map(el => el.dataset.eventId))).find(id => id !== eventId);
    await carousel.locator(`[data-event-id="${otherId}"]`).click();
    assert.equal(await related.locator('[data-post-id]').count(), saved.posts.filter(post => post.eventId === otherId && post.status !== 'deleted').length);
    assert.doesNotMatch(await related.innerText(), /E2 행사 연결 공고/);
    await detail.getByRole('button', { name: '뒤로가기' }).click();

    await page.locator('#btn-view-all-events').click();
    const all = page.getByRole('dialog', { name: '이벤트 전체보기' });
    await all.getByRole('button', { name: '이전 달' }).click();
    await all.locator('[data-status="ended"]').first().click();
    const createButton = related.getByRole('button', { name: '이 행사로 동행 모집하기' });
    assert.equal(await createButton.isDisabled(), true, 'ended event blocks creation');
    assert.match(await detail.locator('#event-create-blocked').innerText(), /종료된 행사/);
    assert.match(await detail.innerText(), /종료/);
    return `event ${eventId}: 2 → 3 related; other event ${otherId} excluded; ended event disabled`;
  });

  await run('E3', 'post form A and B: same validation, same saved fields, edit restores; others cannot edit; partner condition', async page => {
    await asUser(page, YUMI);
    const day2 = kstKey(2), day1 = kstKey(1);
    // ---- A: one sheet
    await page.locator('#btn-fab-create').click();
    let form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true });
    assert.equal(await form.getAttribute('data-post-form-variant'), 'A');
    await form.getByLabel('모집 제목').fill('');
    await form.locator('button[type="submit"]').click();
    for (const field of ['title', 'description']) assert.equal(await form.locator(`[data-field-error="${field}"]`).count(), 1, `${field} required`);
    await form.getByRole('radio', { name: '전시', exact: true }).click();
    await form.getByLabel('모집 제목').fill('E3 A안 공고');
    await form.getByLabel('동행 상세 소개').fill('A/B 비교용 같은 내용입니다.');
    await form.getByLabel('시작 날짜', { exact: true }).fill(kstKey(-1));
    await form.locator('button[type="submit"]').click();
    assert.match(await form.locator('[data-field-error="startDate"]').innerText(), /지난 일정/);
    await form.getByLabel('시작 날짜', { exact: true }).fill(day2);
    assert.equal(await form.getByLabel('종료 날짜', { exact: true }).inputValue(), day2, 'end date follows start');
    await form.getByLabel('종료 시각', { exact: true }).fill('17:00');
    await form.locator('button[type="submit"]').click();
    assert.match(await form.locator('[data-field-error="endDate"]').innerText(), /종료 시각은 시작 시각보다/);
    await form.getByLabel('종료 시각', { exact: true }).fill('20:00');
    await form.getByLabel('모집 마감 날짜·시각', { exact: true }).fill(`${day2}T19:00`);
    await form.locator('button[type="submit"]').click();
    assert.match(await form.locator('[data-field-error="deadline"]').innerText(), /모집 마감은 현재 시각 이후/);
    await form.getByLabel('모집 마감 날짜·시각', { exact: true }).fill(`${day1}T12:00`);
    await form.getByRole('radiogroup', { name: '상대 성별 조건' }).getByRole('radio', { name: '남성', exact: true }).click();
    await form.getByLabel('태그 (공백으로 구분)').fill('#검증 #폼');
    await page.screenshot({ path: `${out}/step3-post-form-A-mobile.png` });
    await form.locator('button[type="submit"]').click();
    await form.waitFor({ state: 'detached' });
    let data = await until(page, d => d.posts.some(post => post.title === 'E3 A안 공고'), 'A saved');
    const postA = data.posts.find(post => post.title === 'E3 A안 공고');
    assert.equal(postA.partnerGender, 'male');
    assert.equal(postA.recruitmentEndsAt, new Date(`${day1}T12:00:00+09:00`).toISOString());
    assert.equal(postA.endsAt, new Date(`${day2}T20:00:00+09:00`).toISOString());

    await (await openOwnPost(page, /E3 A안 공고/)).getByRole('button', { name: '공고 수정', exact: true }).click();
    let edit = page.getByRole('dialog', { name: '동행 공고 수정', exact: true });
    assert.equal(await edit.getByLabel('모집 제목').inputValue(), 'E3 A안 공고');
    assert.equal(await edit.getByLabel('시작 날짜', { exact: true }).inputValue(), day2);
    assert.equal(await edit.getByLabel('종료 시각', { exact: true }).inputValue(), '20:00');
    assert.equal(await edit.getByLabel('모집 마감 날짜·시각', { exact: true }).inputValue(), `${day1}T12:00`);
    assert.equal(await edit.getByRole('radio', { name: '남성', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await edit.getByRole('radio', { name: '전시', exact: true }).getAttribute('aria-checked'), 'true');
    await edit.getByRole('button', { name: '공고 작성 창 닫기' }).click();

    // ---- B: two steps, same values
    await setFormVariant(page, 'B');
    await page.locator('#btn-fab-create').click();
    form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true });
    assert.equal(await form.getAttribute('data-post-form-variant'), 'B');
    await form.getByRole('button', { name: '다음', exact: true }).click();
    assert.equal(await form.locator('[data-form-step]').getAttribute('data-form-step'), '1', 'B stays on step 1 with errors');
    assert.equal(await form.locator('[data-field-error="title"]').count(), 1);
    await form.getByRole('radio', { name: '전시', exact: true }).click();
    await form.getByLabel('모집 제목').fill('E3 B안 공고');
    await form.getByLabel('동행 상세 소개').fill('A/B 비교용 같은 내용입니다.');
    await form.getByLabel('시작 날짜', { exact: true }).fill(day2);
    await form.getByLabel('종료 시각', { exact: true }).fill('17:00');
    await form.getByRole('button', { name: '다음', exact: true }).click();
    assert.match(await form.locator('[data-field-error="endDate"]').innerText(), /종료 시각은 시작 시각보다/);
    await form.getByLabel('종료 시각', { exact: true }).fill('20:00');
    await form.getByLabel('모집 마감 날짜·시각', { exact: true }).fill(`${day1}T12:00`);
    await form.getByRole('button', { name: '다음', exact: true }).click();
    assert.equal(await form.locator('[data-form-step]').getAttribute('data-form-step'), '2');
    await form.getByLabel('공개 만남 지역').fill('');
    await form.locator('button[type="submit"]').click();
    assert.equal(await form.locator('[data-field-error="location"]').count(), 1, 'step 2 required field');
    await form.getByLabel('공개 만남 지역').fill('서울 강남구 대치동');
    await form.getByRole('radiogroup', { name: '상대 성별 조건' }).getByRole('radio', { name: '남성', exact: true }).click();
    await form.getByLabel('태그 (공백으로 구분)').fill('#검증 #폼');
    await page.screenshot({ path: `${out}/step3-post-form-B-mobile.png` });
    await form.getByRole('button', { name: '1:1 동행 등록 완료' }).click();
    await form.waitFor({ state: 'detached' });
    data = await until(page, d => d.posts.some(post => post.title === 'E3 B안 공고'), 'B saved');
    const postB = data.posts.find(post => post.title === 'E3 B안 공고');
    assert.deepEqual(pick(postB), pick(postA), 'A and B save the same fields');

    await (await openOwnPost(page, /E3 B안 공고/)).getByRole('button', { name: '공고 수정', exact: true }).click();
    edit = page.getByRole('dialog', { name: '동행 공고 수정', exact: true });
    assert.equal(await edit.getAttribute('data-post-form-variant'), 'B');
    assert.equal(await edit.getByLabel('모집 제목').inputValue(), 'E3 B안 공고');
    assert.equal(await edit.getByLabel('모집 마감 날짜·시각', { exact: true }).inputValue(), `${day1}T12:00`);
    await edit.getByRole('button', { name: '다음', exact: true }).click();
    assert.equal(await edit.getByRole('radio', { name: '남성', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await edit.getByLabel('공개 랜드마크').inputValue(), postA.publicLocation);
    await edit.getByRole('button', { name: '공고 수정 완료' }).click();
    await edit.waitFor({ state: 'detached' });
    data = await stored(page);
    assert.deepEqual(pick(data.posts.find(post => post.title === 'E3 B안 공고')), pick(postB), 'unchanged edit keeps every field');
    await closeDetail(page);

    // ---- Someone else: no edit; condition blocks a woman, allows a man.
    await asUser(page, 'user-seojin');
    await nav(page, 'explore');
    await page.getByLabel('공고 검색').fill('E3 A안');
    await page.locator('[aria-label="공고 목록"] [data-post-id]').first().click();
    const detail = postDetail(page);
    assert.equal(await detail.getByRole('button', { name: '공고 수정', exact: true }).count(), 0, 'non-author has no edit');
    assert.equal(await detail.getByRole('button', { name: '공고 삭제하기' }).count(), 0);
    assert.equal(await detail.getByRole('button', { name: '신청 조건에 맞지 않아요' }).isDisabled(), true);
    assert.match(await detail.locator('#join-blocked-reason').innerText(), /남성만 신청/);
    assert.match(await detail.innerText(), /상대 조건: 남성만 신청 가능/);
    await closeDetail(page);
    await asUser(page, 'user-req-1');
    await page.locator('[aria-label="공고 목록"] [data-post-id]').first().click();
    assert.equal(await detail.getByRole('button', { name: '1:1 동행 참여 신청하기' }).isEnabled(), true, 'eligible man can apply');
    return 'A/B saved fields equal, edit restore in both variants, author-only edit, condition gate';
  });

  await run('E4', 'condition change requires re-consent; consent alone does not confirm; host acceptance confirms 1:1', async page => {
    await asUser(page, YUMI);
    await (await openOwnPost(page, /성수동 디저트/)).getByRole('button', { name: '공고 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '동행 공고 수정', exact: true });
    await edit.getByRole('radiogroup', { name: '상대 성별 조건' }).getByRole('radio', { name: '남성', exact: true }).click();
    await edit.locator('button[type="submit"]').click();
    await edit.waitFor({ state: 'detached' });
    await closeDetail(page);
    let data = await until(page, d => d.requests.find(r => r.id === 'req-init-1')?.status === 'reconfirming', 'reconfirming');
    assert.equal(data.posts.find(post => post.id === 'post-demo-host').partnerGender, 'male');
    await nav(page, 'me');
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    assert.equal(await requestCard(page, 'req-init-1').getByRole('button', { name: '조건 동의 대기' }).isDisabled(), true);

    await asUser(page, 'user-req-1');
    await nav(page, 'me');
    await page.getByRole('tab', { name: /신청한 동행/ }).click();
    const review = requestCard(page, 'req-init-1').getByRole('region', { name: '변경 조건 확인' });
    assert.match(await review.innerText(), /상대 성별 조건/);
    await review.getByRole('button', { name: '변경 조건에 동의' }).click();
    data = await until(page, d => d.requests.find(r => r.id === 'req-init-1')?.status === 'pending', 'consented');
    assert.equal(data.appointments.some(item => item.id === 'apt-req-init-1'), false, 'consent does not confirm');
    assert.match(await requestCard(page, 'req-init-1').innerText(), /매칭 중 · 확정 전/);
    assert.equal(await requestCard(page, 'req-init-1').getByRole('button', { name: '수락하기' }).count(), 0, 'requester cannot accept');

    await asUser(page, YUMI);
    await nav(page, 'me');
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    await requestCard(page, 'req-init-1').getByRole('button', { name: '수락하기', exact: true }).click();
    const room = page.getByRole('region', { name: '동행 대화방', exact: true });
    assert.match(await room.innerText(), /작성자가 수락해 동행이 확정/);
    data = await until(page, d => d.appointments.some(item => item.id === 'apt-req-init-1'), 'confirmed');
    assert.equal(data.requests.find(r => r.id === 'req-init-1').status, 'accepted');
    assert.equal(data.requests.find(r => r.id === 'req-init-2').status, 'matched_with_other');
    assert.equal(data.posts.find(post => post.id === 'post-demo-host').closedReason, 'matched');
    assert.equal(data.rooms.find(item => item.id === 'room-req-init-1').appointmentId, 'apt-req-init-1', 'same room carries the appointment');

    await nav(page, 'me');
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    assert.match(await requestCard(page, 'req-init-2').innerText(), /다른 동행자와 확정/);
    assert.equal(await requestCard(page, 'req-init-2').locator('[data-request-reason]').count(), 1);
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    assert.match(await page.locator('[data-appointment-card="apt-req-init-1"]').innerText(), /김\*수/);
    assert.match(await activity(page).getByRole('tab', { name: /확정/ }).innerText(), /확정 \d+/);
    await activity(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/step3-me-status-mobile.png` });

    await asUser(page, 'user-req-1');
    await nav(page, 'me');
    assert.match(await requestCard(page, 'req-init-1').innerText(), /매칭 확정/);
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    assert.match(await page.locator('[data-appointment-card="apt-req-init-1"]').innerText(), /조\*미/, 'partner shown from the requester side');
    return 'reconfirming → consent → pending → host accept → matched_with_other + same room + Me both sides';
  });

  await run('E5', 'apply → optional chat kept across tabs/reload → host accept → Me/home → cancel shows the same state on both sides', async page => {
    await asUser(page, 'user-req-1');
    await nav(page, 'explore');
    await page.getByLabel('공고 검색').fill('주말 사진전');
    await page.locator('[aria-label="공고 목록"] [data-post-id="post-exhibition-open"]').click();
    await postDetail(page).getByRole('button', { name: '1:1 동행 참여 신청하기' }).click();
    const apply = page.getByRole('dialog', { name: '동행 참여 신청', exact: true });
    await apply.locator('textarea').fill('사진전 같이 보고 싶어요.');
    await apply.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
    const room = page.getByRole('region', { name: '동행 대화방', exact: true });
    await room.waitFor();
    await page.getByRole('textbox', { name: '메시지', exact: true }).fill('E5 확정 전 대화입니다');
    await page.getByRole('button', { name: '메시지 보내기' }).click();
    assert.equal(await page.getByRole('button', { name: '동행 수락하기' }).count(), 0, 'requester has no accept button');
    await nav(page, 'home');
    await nav(page, 'chat');
    assert.match(await room.innerText(), /E5 확정 전 대화입니다/);
    await page.reload({ waitUntil: 'networkidle' });
    await nav(page, 'chat');
    if (await page.getByRole('button', { name: '채팅 목록으로', exact: true }).count()) await page.getByRole('button', { name: '채팅 목록으로', exact: true }).click();
    let data = await until(page, d => d.requests.some(r => r.requesterId === 'user-req-1' && r.postId === 'post-exhibition-open'), 'request');
    const requestId = data.requests.find(r => r.requesterId === 'user-req-1' && r.postId === 'post-exhibition-open').id;
    await page.locator(`[data-room-id="room-${requestId}"]`).click();
    assert.match(await room.innerText(), /E5 확정 전 대화입니다/, 'chat kept after reload');

    await asUser(page, 'user-seojin');
    await nav(page, 'me');
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    assert.match(await requestCard(page, 'req-sent-demo').innerText(), /매칭 중 · 확정 전/);
    await requestCard(page, requestId).getByRole('button', { name: '수락하기', exact: true }).click();
    data = await until(page, d => d.appointments.some(item => item.id === `apt-${requestId}`), 'accepted');
    assert.equal(data.requests.find(r => r.id === 'req-sent-demo').status, 'matched_with_other');
    assert.equal(data.requests.filter(r => r.postId === 'post-exhibition-open' && r.status === 'accepted').length, 1, 'exactly one match');
    await nav(page, 'me');
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    const card = page.locator(`[data-appointment-card="apt-${requestId}"]`);
    assert.match(await card.innerText(), /김\*수/);
    await nav(page, 'home');
    assert.equal(await page.locator(`[data-testid="appointment-carousel"] [data-appointment-id="apt-${requestId}"]`).count(), 1, 'home reminder');

    await nav(page, 'me');
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    await card.getByRole('button', { name: '약속 상세' }).click();
    await page.getByRole('dialog', { name: '약속 상세', exact: true }).getByRole('button', { name: '확정 동행 취소' }).click();
    const cancel = page.getByRole('dialog', { name: '확정 동행 취소', exact: true });
    await cancel.getByText('일정이 변경됐어요', { exact: true }).click();
    await cancel.getByRole('button', { name: '확정 동행 취소하기' }).click();
    data = await until(page, d => d.appointments.find(item => item.id === `apt-${requestId}`)?.status === '동행 취소', 'cancelled');
    if (await page.getByRole('button', { name: '참여 대시보드 닫기' }).count()) await page.getByRole('button', { name: '참여 대시보드 닫기' }).click();
    await dismiss(page);
    assert.equal(data.blocks.length, 0, 'cancelling does not block');
    await nav(page, 'me');
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    assert.equal(await card.count(), 0, 'no longer confirmed');
    await activity(page).getByRole('tab', { name: /취소/ }).click();
    assert.match(await card.innerText(), /내가 취소했어요 · 사유: 일정이 변경됐어요/);
    await nav(page, 'home');
    assert.equal(await page.locator(`[data-appointment-id="apt-${requestId}"]`).count(), 0, 'cancelled reminder removed');

    await asUser(page, YUMI);
    await nav(page, 'me');
    await page.getByRole('tab', { name: /신청한 동행/ }).click();
    assert.match(await requestCard(page, 'req-sent-demo').innerText(), /다른 동행자와 확정/);
    assert.match(await requestCard(page, 'req-sent-demo').locator('[data-request-reason]').innerText(), /다른 신청자와 1:1로 확정/);

    await asUser(page, 'user-req-1');
    await nav(page, 'me');
    await activity(page).getByRole('tab', { name: /취소/ }).click();
    assert.match(await card.innerText(), /상대가 취소했어요/);
    await nav(page, 'explore');
    await page.getByLabel('공고 검색').fill('주말 사진전');
    assert.match(await page.locator('[data-post-id="post-exhibition-open"]').innerText(), /동행 취소 · 모집 종료/);
    return `request ${requestId}: chat kept, accepted once, other candidate ended, cancel mirrored`;
  });

  await run('E6', 'close and delete: Me reasons, requester reason, deleted link returns, closing is not completion', async page => {
    await asUser(page, YUMI);
    const detail = await openOwnPost(page, /성수동 디저트/);
    await detail.getByRole('button', { name: '모집 조기 마감' }).click();
    await page.getByRole('dialog', { name: '모집 마감', exact: true }).getByRole('button', { name: '모집 마감하기' }).click();
    await dismiss(page);
    await closeDetail(page);
    await nav(page, 'me');
    const own = page.locator('[data-own-post="post-demo-host"]');
    assert.equal(await own.getAttribute('data-post-status'), 'closed');
    assert.match(await own.locator('[data-post-reason]').innerText(), /완료된 것은 아니에요/);
    assert.match(await activity(page).getByRole('tab', { name: /완료/ }).innerText(), /완료 0/, 'closing does not add a completion');

    await asUser(page, 'user-req-1');
    await nav(page, 'me');
    assert.match(await requestCard(page, 'req-init-1').locator('[data-request-reason]').innerText(), /모집을 마감/);

    await asUser(page, YUMI);
    await (await openOwnPost(page, /성수동 디저트/)).getByRole('button', { name: '공고 삭제하기', exact: true }).click();
    await page.getByRole('dialog', { name: '공고 삭제', exact: true }).getByRole('button', { name: '공고 삭제하기', exact: true }).click();
    await dismiss(page);
    await page.getByRole('button', { name: '이전 화면으로', exact: true }).click();
    await nav(page, 'me');
    assert.equal(await own.getAttribute('data-post-status'), 'deleted');
    assert.match(await own.locator('[data-post-reason]').innerText(), /삭제한 공고/);
    await own.getByRole('button', { name: /성수동 디저트/ }).click();
    await page.getByRole('dialog', { name: '삭제된 공고', exact: true }).getByRole('button', { name: '이전 화면으로' }).click();
    assert.equal(await activity(page).isVisible(), true, 'returned to Me');
    await nav(page, 'explore');
    assert.equal(await page.locator('[data-post-id="post-demo-host"]').count(), 0, 'deleted post not listed');
    await page.screenshot({ path: `${out}/step3-explore-after-delete-mobile.png` });
    return 'closed/deleted reasons in Me; requester reason; deleted link returns';
  });

  await run('E7', 'Me status and invitation skeleton at 1280×900', async page => {
    await asUser(page, YUMI);
    await nav(page, 'me');
    const invitations = page.getByRole('region', { name: '초대 관리', exact: true });
    assert.match(await invitations.innerText(), /받은 초대 0/);
    await invitations.getByRole('tab', { name: /보낸 초대/ }).click();
    assert.match(await invitations.innerText(), /아직 보낸 초대가 없어요/);
    assert.equal(await activity(page).getByRole('tab', { name: /확정/ }).getAttribute('aria-selected'), 'true', 'Me opens on confirmed meetups');
    assert.equal(await page.getByRole('region', { name: '내가 쓴 공고' }).locator('[data-own-post]').count(), (await stored(page)).posts.filter(post => post.authorId === YUMI).length);
    for (const tab of ['완료', '취소', '확정']) {
      await activity(page).getByRole('tab', { name: new RegExp(tab) }).click();
      assert.equal(await activity(page).getByRole('tab', { name: new RegExp(tab) }).getAttribute('aria-selected'), 'true');
    }
    await activity(page).getByRole('tab', { name: /확정/ }).click();
    const data = await stored(page);
    const confirmed = data.appointments.filter(item => item.participantIds?.includes(YUMI) && item.status === '매칭 확정').length;
    assert.equal(await page.locator('[data-appointment-card]').count(), confirmed);
    await page.screenshot({ path: `${out}/step3-me-desktop.png`, fullPage: true });
    return `confirmed cards ${confirmed}`;
  }, { width: 1280, height: 900 });

  fs.writeFileSync(`${out}/step3-explore-post-me.json`, JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass: result.cases.filter(c => c.status === 'PASS').length, total: result.cases.length, errors: result.errors, externalRequests: result.externalRequests }));
  if (result.cases.some(c => c.status === 'FAIL') || result.errors.length || result.externalRequests.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
