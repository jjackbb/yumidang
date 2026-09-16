// UI-only check. OTP requests are intercepted; this does not prove remote authentication.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
  try {
    const page = await browser.newPage();
    let submitted;
    await page.route('**/auth/v1/otp', async route => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto(process.env.CHECK_URL || 'http://127.0.0.1:4191/');
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    const phone = page.locator('#auth-phone');
    await phone.pressSequentially('01000000001');
    assert.equal(await phone.inputValue(), '010-0000-0001');
    await phone.press('Backspace');
    assert.equal(await phone.inputValue(), '010-0000-000');
    await phone.fill('010-1234-5678');
    assert.equal(await phone.inputValue(), '010-1234-5678');
    await phone.evaluate(input => input.setSelectionRange(4, 4));
    await phone.press('Backspace');
    assert.equal(await phone.inputValue(), '011-2345-678');
    await phone.fill('01012345678');
    await phone.evaluate(input => input.setSelectionRange(3, 3));
    await phone.press('Delete');
    assert.equal(await phone.inputValue(), '010-2345-678');
    await phone.fill('01000000001');
    await page.getByRole('button', { name: '인증번호 요청', exact: true }).click();
    await page.locator('#auth-otp').waitFor();
    assert.equal(submitted.phone, '+821000000001');
    await phone.fill('01000000002');
    assert.equal(await page.locator('#auth-otp').count(), 0);
    console.log('PASS: numeric typing, formatted input, separator deletion, E.164 request, OTP invalidation after phone edit (API mocked)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
