const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const url = process.env.CHECK_URL || 'http://127.0.0.1:3000/';
const targetTitle = '성수역 팝업스토어 같이 구경해요';
const expectedTitles = [
  targetTitle,
  '홍대 돈까스 저녁 식사 동행 구해요',
  '서울숲에서 가볍게 산책해요',
  '대학로에서 연극 한 편 같이 봐요',
  '용산에서 영화 보고 이야기 나눠요',
  '망원시장 먹거리 구경 같이 해요',
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const authorRpc = [];
  page.on('request', request => { if (request.url().includes('/rpc/get_post_author_profile')) authorRpc.push(request.url()); });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#nav-tab-explore').click();
    for (const title of expectedTitles) await page.getByText(title, { exact: true }).first().waitFor();

    await page.getByText(targetTitle, { exact: true }).first().click();
    let detail = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    await detail.waitFor();
    assert.equal(await detail.locator('[data-author-demographics]').count(), 0, 'anonymous detail exposed demographics');
    assert.equal(authorRpc.length, 0, 'anonymous detail called protected author RPC');
    await detail.getByRole('button', { name: '공고 상세 닫기', exact: true }).click();

    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('#auth-phone').fill('01055555555');
    await page.getByRole('button', { name: '인증번호 요청', exact: true }).click();
    await page.locator('#auth-otp').waitFor();
    await page.getByRole('button', { name: '테스트 OTP 입력', exact: true }).click();
    await page.getByRole('button', { name: 'Supabase에서 인증 확인', exact: true }).click();
    await page.getByRole('dialog', { name: '로그인', exact: true }).waitFor({ state: 'detached' });

    await page.getByText(targetTitle, { exact: true }).first().click();
    detail = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    const demographics = detail.locator('[data-author-demographics]');
    await demographics.waitFor();
    assert.match((await demographics.innerText()).trim(), /^남성 · 만 \d+세$/);
    assert.ok(authorRpc.length > 0, 'authenticated detail did not call author RPC');

    const evidenceDir = path.resolve('docs/backend-implementation/evidence/signup-eligibility-author-20260917');
    fs.mkdirSync(evidenceDir, { recursive: true });
    await detail.locator('[data-author-id]').screenshot({ path: path.join(evidenceDir, 'logged-in-author-demographics.png') });
    console.log(JSON.stringify({ result: 'PASS', anonymousRpcCalls: 0, authenticatedRpcCalls: authorRpc.length, demographics: await demographics.innerText(), preservedTitles: expectedTitles.length }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
