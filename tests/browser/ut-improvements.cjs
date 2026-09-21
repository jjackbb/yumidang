const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const url = process.env.CHECK_URL || 'http://127.0.0.1:4186/?demo=1';
const out = process.env.EVIDENCE_DIR || 'docs/archive/ut-improvements/evidence';
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const result = { url, cases: [], errors: [] };
const DAY = 86_400_000;
const dateKey = offset => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + offset * DAY));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); });

  async function check(name, fn) {
    try { await fn(); result.cases.push({ name, status: 'PASS' }); }
    catch (error) { result.cases.push({ name, status: 'FAIL', detail: error.message }); }
  }
  const nav = id => page.locator(`#nav-tab-${id}`).click();
  const panel = () => page.getByRole('region', { name: '체험 설정', exact: true });
  const openPanel = async () => {
    const toggle = panel().getByRole('button', { name: /체험 설정/ });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  };
  const closePanel = async () => {
    const toggle = panel().getByRole('button', { name: /체험 설정/ });
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
  };

  await page.goto(url, { waitUntil: 'networkidle' });

  await check('page renders without framework overlay', async () => {
    assert.ok((await page.locator('body').innerText()).trim().length > 100);
    assert.equal(await page.locator('.vite-error-overlay, #webpack-dev-server-client-overlay').count(), 0);
    assert.equal(await page.getByRole('button', { name: '둘러보기', exact: true }).count(), 1);
    await page.screenshot({ path: `${out}/ut-home-mobile.png`, fullPage: true });
  });

  await openPanel();
  await panel().locator('[data-demo-user="user-demo-yumi"]').click();
  await panel().getByRole('radiogroup', { name: '04 공고 작성 안' }).getByRole('radio', { name: 'B안' }).click();
  await closePanel();

  await check('authenticated demographic filters are separate and visible', async () => {
    await nav('explore');
    const filters = page.getByRole('region', { name: '탐색 필터', exact: true });
    await filters.getByLabel('작성자 성별').selectOption('female');
    await filters.getByLabel('작성자 연령대').selectOption('20s');
    assert.match(await filters.innerText(), /신청 가능 조건과는 별개/);
    assert.ok(await page.locator('[aria-label="공고 목록"] [data-post-id]').count() > 0);
    await page.screenshot({ path: `${out}/ut-demographic-filters-mobile.png`, fullPage: true });
  });

  await check('detail has a clear close and browser-back exit', async () => {
    await page.getByRole('button', { name: '필터 초기화' }).click();
    await page.locator('[aria-label="공고 목록"] [data-post-id]').first().click();
    const detail = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    await detail.waitFor();
    assert.equal(await detail.getByRole('button', { name: '공고 상세 닫기' }).count(), 1);
    await page.goBack();
    await detail.waitFor({ state: 'detached' });
  });

  await check('greeting suggestion fills the editable draft and never auto-sends', async () => {
    await nav('chat');
    await page.locator('[data-room-id]').first().click();
    const room = page.getByRole('region', { name: '동행 대화방', exact: true });
    const messagesBefore = await room.locator('[class*="rounded-2xl"]').count();
    const greeting = room.getByRole('button', { name: '안녕하세요! 공고 보고 연락드렸어요.', exact: true });
    await greeting.click();
    assert.equal(await room.getByRole('textbox', { name: '메시지', exact: true }).inputValue(), '안녕하세요! 공고 보고 연락드렸어요.');
    assert.equal(await room.locator('[class*="rounded-2xl"]').count(), messagesBefore);
  });

  await check('two-step post form preserves data, confirms discard, and opens the saved detail', async () => {
    await nav('home');
    await page.locator('#btn-fab-create').click();
    const form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true });
    assert.equal(await form.getAttribute('data-post-form-variant'), 'B');
    await form.getByLabel('모집 제목').fill('UT 개선 확인 공고');
    await form.getByLabel('동행 상세 소개').fill('등록 성공 뒤 상세 화면 이동을 확인합니다.');
    await form.getByLabel('시작 날짜', { exact: true }).fill(dateKey(30));
    await form.getByRole('button', { name: '다음', exact: true }).click();
    assert.match(await form.getByRole('region', { name: '등록 전 최종 확인' }).innerText(), /공개 지역:.*상대 조건:/s);
    await form.getByRole('button', { name: '공고 작성 창 닫기' }).click();
    const discard = page.getByRole('alertdialog', { name: '작성 내용 삭제 확인' });
    await discard.waitFor();
    await discard.getByRole('button', { name: '계속 작성' }).click();
    assert.equal(await form.getByLabel('공개 만남 지역').inputValue(), '서울 강남구 대치동');
    await form.getByRole('button', { name: '1:1 동행 등록 완료' }).click();
    await form.waitFor({ state: 'detached' });
    const detail = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    await detail.waitFor();
    assert.match(await detail.innerText(), /UT 개선 확인 공고/);
    await page.screenshot({ path: `${out}/ut-created-post-detail-mobile.png`, fullPage: true });
  });

  assert.equal(result.errors.length, 0, `browser errors: ${result.errors.join(' | ')}`);
  assert.equal(result.cases.some(item => item.status === 'FAIL'), false, JSON.stringify(result.cases));
  console.log(JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
