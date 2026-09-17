const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const appUrl = process.env.CHECK_URL || 'http://127.0.0.1:3000/';
const projectOrigin = 'https://bndguguarijmghnkenvt.supabase.co';
const userId = '11111111-1111-4111-8111-111111111111';
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
const accessToken = `${header}.${payload}.mock-signature`;
const session = {
  access_token: accessToken,
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: { id: userId, aud: 'authenticated', role: 'authenticated', phone: '+821055555555', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARAwMjDAGCAYAKkQCBf3W5ikAAAAASUVORK5CYII=', 'base64');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ storedSession }) => {
    localStorage.setItem('sb-bndguguarijmghnkenvt-auth-token', JSON.stringify(storedSession));
  }, { storedSession: session });

  let uploadCalls = 0;
  let signupRpcCalls = 0;
  let committedProfile = null;
  const uploadedPaths = [];

  await context.route(`${projectOrigin}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname === '/auth/v1/user') return json(session.user);
    if (url.pathname.startsWith('/storage/v1/object/profile-images/')) {
      uploadCalls += 1;
      const path = decodeURIComponent(url.pathname.split('/storage/v1/object/profile-images/')[1]);
      uploadedPaths.push(path);
      if (uploadCalls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'forced mock upload failure' }) });
      return json({ Key: `profile-images/${path}` });
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/profile-images/')) {
      return json({ signedURL: `${url.pathname}?token=mock-signed-token` });
    }
    if (url.pathname === '/rest/v1/rpc/complete_signup_with_avatar') {
      signupRpcCalls += 1;
      const body = JSON.parse(request.postData() || '{}');
      if (signupRpcCalls === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'MOCK_RPC', message: 'forced mock RPC failure' }) });
      committedProfile = {
        id: userId, real_name: body.p_real_name, birth_date: body.p_birth_date, gender: body.p_gender,
        avatar_url: body.p_avatar_path, bio: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      return json([committedProfile]);
    }
    if (url.pathname === '/rest/v1/profiles') return json(committedProfile ? [committedProfile] : []);
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: `unhandled mock ${url.pathname}` }) });
  });

  const page = await context.newPage();
  try {
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog', { name: '회원가입', exact: true });
    await dialog.locator('#auth-real-name').waitFor();
    const submit = dialog.getByRole('button', { name: '사진과 기본 프로필 저장하고 가입 완료', exact: true });
    assert.equal(await submit.isDisabled(), true, 'signup must be disabled without a valid photo');

    await dialog.locator('#auth-profile-photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
    await dialog.getByAltText('선택한 프로필 사진 미리보기').waitFor();
    assert.equal(await submit.isEnabled(), true);
    await dialog.locator('#auth-real-name').fill('홍길동');
    await dialog.getByRole('button', { name: '여성', exact: true }).click();
    await dialog.locator('#auth-birth').fill('1998-04-12');

    await submit.click();
    await dialog.getByRole('alert').waitFor();
    assert.match(await dialog.getByRole('alert').innerText(), /업로드에 실패/);
    assert.equal(signupRpcCalls, 0, 'profile RPC must not run after upload failure');
    assert.equal(await dialog.getByAltText('선택한 프로필 사진 미리보기').isVisible(), true, 'same-screen retry keeps preview');

    await submit.click();
    await dialog.getByRole('alert').waitFor();
    assert.match(await dialog.getByRole('alert').innerText(), /프로필에 저장하지 못했어요/);
    assert.equal(uploadCalls, 2);
    assert.equal(signupRpcCalls, 1);

    await submit.click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(uploadCalls, 2, 'RPC retry must reuse the already uploaded path');
    assert.equal(signupRpcCalls, 2);
    assert.equal(uploadedPaths[1], committedProfile.avatar_url);
    assert.match(committedProfile.avatar_url, new RegExp(`^${userId}/[0-9a-f-]{36}\\.jpg$`));
    assert.equal(await page.getByRole('dialog', { name: '프로필 만들기' }).count(), 0, 'successful signup must skip a second photo step');
    console.log(JSON.stringify({ result: 'PASS', network: 'fully mocked', uploadCalls, signupRpcCalls, reusedPath: true, skippedSecondPhotoStep: true }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
