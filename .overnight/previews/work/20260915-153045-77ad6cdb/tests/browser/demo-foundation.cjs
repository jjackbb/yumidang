// Step 1 browser check: explicit demo mode, persistence, broken-storage recovery, reset, role/time switching, API isolation.
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const url = process.env.CHECK_URL || 'http://127.0.0.1:4186/?demo=1';
const plainUrl = url.replace(/[?&]demo=1/, '').replace(/\?$/, '');
const out = process.env.EVIDENCE_DIR || 'docs/overnight/evidence';
const DEMO_KEY = 'yumidang:demo:v1';
const APP_KEY = 'yumidang:app:v1';
const result = { url, mode: 'step-1 demo foundation', cases: [], errors: [], externalRequests: [] };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  async function run(id, name, fn, viewport = { width: 390, height: 844 }) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => result.errors.push(`${id}: ${error.message}`));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => {
      if (/supabase\.co|google-analytics|googletagmanager|generativelanguage/.test(request.url())) result.externalRequests.push(`${id}: ${request.url()}`);
    });
    try {
      const details = await fn(page, context);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
      result.cases.push({ id, name, status: 'PASS', details: details || '' });
    } catch (error) {
      result.cases.push({ id, name, status: 'FAIL', details: error.message });
      await page.screenshot({ path: `${out}/step1-failure-${id}.png` }).catch(() => {});
    } finally {
      await context.close();
      console.log(result.cases.at(-1));
    }
  }
  const panel = page => page.getByRole('region', { name: '체험 설정', exact: true });
  const openPanel = async page => {
    const toggle = panel(page).getByRole('button', { name: /체험 설정/ });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  };
  const demoTime = async page => Date.parse(await page.locator('[data-demo-time]').getAttribute('data-demo-time'));
  const stored = (page, key = DEMO_KEY) => page.evaluate(k => localStorage.getItem(k), key);

  await run('S1', 'demo controls only with explicit ?demo=1', async page => {
    await page.goto(plainUrl, { waitUntil: 'networkidle' });
    assert.equal(await panel(page).count(), 0, 'panel visible without demo=1');
    await page.goto(url, { waitUntil: 'networkidle' });
    await panel(page).waitFor();
    assert.equal(await page.locator('[data-demo-role]').textContent(), '로그아웃 상태');
    assert.equal(await page.locator('header').getByRole('button', { name: '로그인', exact: true }).count(), 1);
    await openPanel(page);
    await page.screenshot({ path: `${out}/step1-demo-panel-mobile.png`, fullPage: false });
    return 'panel hidden on plain URL, demo starts logged out with 로그인 header';
  });

  await run('S2', 'login, tab and role/time survive reload; existing header login still works', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await page.getByRole('button', { name: '테스트코드 입력', exact: true }).click();
    await page.getByRole('button', { name: '인증 확인 및 로그인', exact: true }).click();
    assert.equal(await page.locator('[data-demo-role]').textContent(), '조*미');
    await page.locator('#nav-tab-chat').click();
    await page.locator('[data-room-id="room-req-sent-demo"]').waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-demo-role]').textContent(), '조*미', 'login lost on reload');
    await page.locator('[data-room-id="room-req-sent-demo"]').waitFor();
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-seojin"]').click();
    assert.equal(await page.locator('[data-demo-role]').textContent(), '서*진');
    const before = await demoTime(page);
    await panel(page).getByRole('button', { name: '+1일', exact: true }).click();
    await page.waitForFunction(previous => Date.parse(document.querySelector('[data-demo-time]').getAttribute('data-demo-time')) - previous > 3_600_000, before);
    const shifted = await demoTime(page);
    assert.ok(Math.abs(shifted - before - 86_400_000) < 120_000, `time shift ${shifted - before}`);
    await panel(page).getByRole('radio', { name: 'B안' }).first().click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-demo-role]').textContent(), '서*진', 'role lost on reload');
    assert.ok(Math.abs(await demoTime(page) - shifted) < 120_000, 'time offset lost on reload');
    const saved = JSON.parse(await stored(page));
    assert.equal(saved.version, 1);
    assert.equal(saved.data.activeUserId, 'user-seojin');
    assert.equal(saved.data.demo.variants.profile, 'B');
    assert.equal(saved.data.ui.activeTab, 'chat');
    await page.locator('#nav-tab-chat').click();
    // 서*진 hosts req-sent-demo, but is not part of 조*미's room with 김*수.
    await page.locator('[data-room-id="room-req-sent-demo"]').waitFor();
    assert.equal(await page.locator('[data-room-id="room-req-init-1"]').count(), 0, 'other role still sees 조*미·김*수 private room');
    return 'login→chat→reload kept; switched to 서*진 +1day B안 kept after reload; 서*진 sees own hosted room only, not 조*미·김*수 room';
  });

  await run('S3', 'corrupt storage keeps the screen, offers retry and reset', async (page, context) => {
    await context.addInitScript(key => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{broken'); sessionStorage.setItem('seeded', '1'); } }, DEMO_KEY);
    await page.goto(url, { waitUntil: 'networkidle' });
    const alert = page.locator('[data-storage-issue="corrupt"]');
    await alert.waitFor();
    await page.locator('header').waitFor();
    assert.equal(await stored(page), '{broken', 'broken data was overwritten before user choice');
    await page.getByRole('button', { name: '저장 다시 시도', exact: true }).click();
    await alert.waitFor();
    await page.getByRole('button', { name: '저장 데이터 초기화', exact: true }).click();
    assert.equal(await page.locator('[data-storage-issue]').count(), 0);
    assert.equal(JSON.parse(await stored(page)).version, 1);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-storage-issue]').count(), 0);
    return 'corrupt alert shown with app usable, retry kept alert, reset wrote valid v1 data';
  });

  await run('S4', 'demo reset restores seed without touching ordinary app storage', async (page, context) => {
    await context.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, 'ordinary-user-data'); }, APP_KEY);
    await page.goto(url, { waitUntil: 'networkidle' });
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-hoon"]').click();
    await panel(page).getByRole('button', { name: '+7일', exact: true }).click();
    await panel(page).getByRole('button', { name: '체험 데이터 초기화', exact: true }).click();
    await panel(page).getByRole('button', { name: '초기화 실행', exact: true }).click();
    const saved = JSON.parse(await stored(page));
    assert.equal(saved.data.demo.timeOffsetMs, 0);
    assert.equal(saved.data.activeUserId, 'user-hoon', 'sample role kept after reset');
    assert.equal(await stored(page, APP_KEY), 'ordinary-user-data');
    return 'offset back to 0, role kept, app key untouched';
  }, { width: 1280, height: 900 });

  await run('S5', 'demo sends no Supabase/analytics traffic across auth, post detail and logout', async page => {
    const start = result.externalRequests.length;
    await page.goto(url, { waitUntil: 'networkidle' });
    await openPanel(page);
    await panel(page).locator(`[data-demo-user="user-demo-yumi"]`).click();
    await page.locator('#nav-tab-explore').click();
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '공고 상세 닫기', exact: true }).click();
    await page.locator('#nav-tab-me').click();
    await page.locator('button[title="로그아웃"]').click();
    await page.waitForTimeout(800);
    assert.equal(result.externalRequests.length - start, 0, result.externalRequests.slice(start).join(', '));
    assert.equal(await page.locator('[data-demo-role]').textContent(), '로그아웃 상태');
    return 'zero external requests';
  });

  await browser.close();
  if (result.externalRequests.length) result.cases.push({ id: 'S5-global', name: 'no external requests in any case', status: 'FAIL', details: result.externalRequests.join(', ') });
  fs.writeFileSync(`${out}/step1-demo-foundation.json`, JSON.stringify(result, null, 2));
  const failed = result.cases.filter(item => item.status !== 'PASS').length + result.errors.length;
  console.log(JSON.stringify({ cases: result.cases.length, failed, errors: result.errors }));
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
