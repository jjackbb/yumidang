// Explicit live check: creates a persistent test user/profile in the designated project.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('sb-bndguguarijmghnkenvt-auth-token') || 'null'));
    await page.goto(process.env.CHECK_URL || 'http://127.0.0.1:4192/');
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    const phone = process.env.LIVE_TEST_PHONE || '01091610004';
    await page.locator('#auth-phone').fill(phone);
    assert.equal(await page.locator('#auth-phone').inputValue(), `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`);
    await page.getByRole('button', { name: '인증번호 요청', exact: true }).click();
    await page.locator('#auth-otp').fill('000000');
    await page.getByRole('button', { name: 'Supabase에서 인증 확인' }).click();
    await page.getByRole('alert').filter({ hasText: '인증번호가 맞지 않아요' }).waitFor();
    assert.equal(await session(), null);
    await page.locator('#auth-otp').fill('123456');
    await page.getByRole('button', { name: 'Supabase에서 인증 확인' }).click();
    await page.locator('#auth-nickname').waitFor();
    const before = await session();
    assert.ok(before.user.id);
    await page.reload();
    await page.locator('#auth-nickname').waitFor();
    assert.equal((await session()).user.id, before.user.id);
    await page.locator('#auth-nickname').fill('화면활성검증');
    await page.locator('#auth-birth').fill('2000-09-16');
    await page.getByText('화면 표시: 26살', { exact: true }).waitFor();
    await page.getByRole('button', { name: '기본 프로필 저장하고 가입 완료' }).click();
    // App closes the signup modal after the authenticated profile state is loaded.
    await page.locator('#auth-nickname').waitFor({ state: 'hidden' });
    await page.reload();
    await page.waitForFunction(() => !!document.querySelector('header') && !document.querySelector('#auth-nickname'));
    assert.equal((await session()).user.id, before.user.id);
    assert.equal(await page.locator('header').getByRole('button', { name: '로그인', exact: true }).count(), 0);
    const saved = await page.evaluate(async () => {
      const { getSupabaseClient } = await import('/src/lib/supabase.ts');
      const result = await getSupabaseClient().from('profiles').select('nickname').single();
      return { nickname: result.data?.nickname, error: result.error?.code };
    });
    assert.equal(saved.error, undefined);
    assert.equal(saved.nickname, '화면활성검증');
    await page.evaluate(async () => {
      const { getSupabaseClient } = await import('/src/lib/supabase.ts');
      await getSupabaseClient().auth.signOut();
    });
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor();
    console.log('PASS: real browser + remote Auth, formatted phone, wrong OTP, incomplete-profile reload, profile save, full age, session/profile reload, logout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
