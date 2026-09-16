// Step 2 browser check: signup, profile setup/edit, incomplete return, partner profile A/B and entry points, privacy.
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const url = process.env.CHECK_URL || 'http://127.0.0.1:4186/?demo=1';
const out = process.env.EVIDENCE_DIR || 'docs/overnight/evidence';
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const DEMO_KEY = 'yumidang:demo:v1';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const result = { url, mode: 'step-2 signup/profile', cases: [], errors: [], externalRequests: [] };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
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
      const details = await fn(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
      result.cases.push({ id, name, status: 'PASS', details: details || '' });
    } catch (error) {
      result.cases.push({ id, name, status: 'FAIL', details: error.message });
      await page.screenshot({ path: `${out}/step2-failure-${id}.png` }).catch(() => {});
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
  const closePanel = async page => {
    const toggle = panel(page).getByRole('button', { name: /체험 설정/ });
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
  };
  const stored = async page => JSON.parse(await page.evaluate(k => localStorage.getItem(k), DEMO_KEY));
  const signupDialog = page => page.getByRole('dialog', { name: '회원가입', exact: true });
  const editor = page => page.getByRole('dialog', { name: '프로필 만들기', exact: true });
  const expectAlert = async (scope, pattern) => {
    const alert = scope.getByRole('alert');
    await alert.first().waitFor();
    assert.match(await alert.first().innerText(), pattern);
  };
  const year = new Date().getFullYear();

  async function startSignup(page) {
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('button', { name: /휴대폰 본인인증으로 가입/ }).click();
    await page.getByText('전체 약관에 동의합니다', { exact: true }).click();
    await page.getByRole('button', { name: '동의하고 다음으로' }).click();
  }
  async function passPhone(page, phone) {
    await page.locator('#auth-phone').fill(phone);
    await page.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await page.getByRole('button', { name: '테스트코드 입력', exact: true }).click();
    await page.getByRole('button', { name: '인증 확인 및 계속하기', exact: true }).click();
  }
  async function quickSignup(page, { phone, name, birth }) {
    await startSignup(page);
    await passPhone(page, phone);
    await page.locator('#auth-name').fill(name);
    await page.locator('#auth-birth').fill(birth);
    await page.getByRole('button', { name: '여성', exact: true }).click();
    await page.getByRole('button', { name: '가입하고 프로필 만들기' }).click();
    await editor(page).waitFor();
  }
  async function uploadAndSavePhoto(page) {
    await page.locator('input[aria-label="프로필 사진 파일 선택"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('[data-photo-state="preview"]').waitFor();
    await page.getByRole('button', { name: '이 사진으로 저장', exact: true }).click();
    await page.locator('[data-photo-state="saved"]').waitFor();
  }
  async function completeProfile(page, bio) {
    await uploadAndSavePhoto(page);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await editor(page).getByRole('button', { name: '전시', exact: true }).click();
    await editor(page).getByRole('button', { name: '차분한', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.locator('#profile-bio').fill(bio);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '프로필 저장하고 시작하기', exact: true }).click();
    await editor(page).waitFor({ state: 'detached' });
  }

  await run('P1', 'signup input errors, male route, photo/interest/bio validation, public preview, persistence', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Login with an unknown number is refused; the dialog is 01 A (no two tabs on top).
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    const login = page.getByRole('dialog', { name: '휴대폰 로그인', exact: true });
    assert.equal(await login.getByRole('tab').count(), 0, 'login/signup tabs on the popup');
    await page.locator('#auth-phone').fill('01011112222');
    await page.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await expectAlert(login, /가입 정보가 없는/);
    await page.getByRole('button', { name: /휴대폰 본인인증으로 가입/ }).click();
    await page.getByText('전체 약관에 동의합니다', { exact: true }).click();
    await page.getByRole('button', { name: '동의하고 다음으로' }).click();

    const phone = page.locator('#auth-phone');
    await phone.fill('');
    await phone.pressSequentially('0109876543219');
    assert.equal(await phone.inputValue(), '01098765432', 'typing 13 digits');
    await phone.fill('');
    await phone.evaluate((element, text) => {
      const data = new DataTransfer();
      data.setData('text', text);
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, '010-9876-54321');
    assert.equal(await phone.inputValue(), '01098765432', 'paste with hyphens and 12 digits');
    await page.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    assert.match(await signupDialog(page).getByRole('status').innerText(), /실제 문자는 보내지 않았어요/);
    await page.locator('#auth-otp').fill('111111');
    await page.getByRole('button', { name: '인증 확인 및 계속하기', exact: true }).click();
    await expectAlert(signupDialog(page), /맞지 않아요/);
    await page.getByRole('button', { name: '테스트코드 입력', exact: true }).click();
    await page.getByRole('button', { name: '인증 확인 및 계속하기', exact: true }).click();

    const submit = () => page.getByRole('button', { name: '가입하고 프로필 만들기' }).click();
    await submit();
    await expectAlert(signupDialog(page), /실명을 입력/);
    await page.locator('#auth-name').fill('박ㅅ준');
    await submit();
    await expectAlert(signupDialog(page), /낱자/);
    await page.locator('#auth-name').fill('Park');
    await submit();
    await expectAlert(signupDialog(page), /한글로만/);
    await page.locator('#auth-name').fill('박서준');
    await page.locator('#auth-birth').fill(`${year + 1}-01-01`);
    await submit();
    await expectAlert(signupDialog(page), /미래/);
    await page.locator('#auth-birth').fill(`${year - 18}-01-01`);
    await submit();
    await expectAlert(signupDialog(page), /19세/);
    await page.locator('#auth-birth').fill('1996-05-20');
    await submit();
    await expectAlert(signupDialog(page), /성별/);
    await page.getByRole('button', { name: '남성', exact: true }).click();
    await submit();
    await expectAlert(signupDialog(page), /추천인 코드를 입력/);
    await page.getByRole('radio', { name: /학교·직장 이메일/ }).click();
    await page.getByLabel('학교·직장 이메일', { exact: true }).fill('park@gmail.com');
    await page.getByRole('button', { name: '확인 메일 보내기' }).click();
    await expectAlert(signupDialog(page), /학교·직장 이메일/);
    await page.getByLabel('학교·직장 이메일', { exact: true }).fill('park@company.co.kr');
    await page.getByRole('button', { name: '확인 메일 보내기' }).click();
    assert.match(await signupDialog(page).getByRole('status').innerText(), /실제 메일은 보내지 않았어요/);
    await page.getByLabel('이메일 확인 코드').fill('000000');
    await submit();
    await expectAlert(signupDialog(page), /확인 코드가 맞지/);
    await page.getByLabel('이메일 확인 코드').fill('246810');
    await page.screenshot({ path: `${out}/step2-signup-basic-mobile.png` });
    await submit();

    // Profile setup step 1: photo validation, preview, save, delete, re-register.
    await editor(page).waitFor();
    const file = page.locator('input[aria-label="프로필 사진 파일 선택"]');
    await file.setInputFiles({ name: 'me.gif', mimeType: 'image/gif', buffer: PNG });
    await expectAlert(editor(page), /JPG, JPEG, PNG/);
    await file.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await expectAlert(editor(page), /10MB/);
    await file.setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
    await expectAlert(editor(page), /읽지 못했어요/);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /사진을 등록/);
    await file.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('[data-photo-state="preview"]').waitFor();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /미리보기 중인 사진/);
    await page.screenshot({ path: `${out}/step2-photo-preview-mobile.png` });
    await page.getByRole('button', { name: '이 사진으로 저장', exact: true }).click();
    await page.locator('[data-photo-state="saved"]').waitFor();
    await page.getByRole('button', { name: '사진 삭제', exact: true }).click();
    await page.getByRole('button', { name: '삭제하기', exact: true }).click();
    await page.locator('[data-photo-state="empty"]').waitFor();
    assert.equal((await stored(page)).data.users.find(user => user.phone === '01098765432').avatar, '', 'deleted photo still stored');
    await uploadAndSavePhoto(page);
    await page.getByRole('button', { name: '다음', exact: true }).click();

    // Step 2: interests.
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /취미를 1개/);
    await editor(page).getByRole('button', { name: '전시', exact: true }).click();
    await editor(page).getByRole('button', { name: '사진', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /성향을 1개/);
    await editor(page).getByRole('button', { name: '차분한', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();

    // Step 3: bio 300 limit and contact filter.
    await page.locator('#profile-bio').fill('가'.repeat(301));
    assert.equal(await page.locator('[data-bio-count]').innerText(), '301/300');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /300자 이하/);
    await page.locator('#profile-bio').fill('연락은 010-1234-5678로 주세요');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expectAlert(editor(page), /연락처/);
    const bio = '전시를 천천히 보고 인상 깊은 작품 이야기를 나누는 걸 좋아해요.';
    await page.locator('#profile-bio').fill(bio);
    await page.getByRole('button', { name: '다음', exact: true }).click();

    // Step 4: public preview matches and hides private data.
    await page.getByRole('button', { name: '공개 프로필 미리보기', exact: true }).click();
    const preview = page.getByRole('dialog', { name: '내 공개 프로필 미리보기', exact: true });
    const previewText = await preview.innerText();
    for (const expected of [bio, '박*준', '30대', '당도 15', '인증 전', '전시']) assert.ok(previewText.includes(expected), `preview missing ${expected}`);
    for (const secret of ['박서준', '01098765432', '1996-05-20', 'park@company.co.kr']) assert.equal(previewText.includes(secret), false, `preview leaks ${secret}`);
    await preview.getByRole('button', { name: '편집으로 돌아가기' }).click();
    await page.getByRole('button', { name: '프로필 저장하고 시작하기', exact: true }).click();
    await editor(page).waitFor({ state: 'detached' });

    await page.locator('#nav-tab-me').click();
    assert.equal(await page.locator('[data-profile-incomplete]').count(), 0);
    const avatar = await page.locator('[data-my-avatar]').getAttribute('src');
    assert.match(avatar, /^data:image\/jpeg/);
    const me = await page.locator('main').innerText();
    for (const expected of ['박*준', '인증 전', '15 🍯', '0회', '0개', bio]) assert.ok(me.includes(expected), `Me missing ${expected}`);
    assert.equal(me.includes('인증회원'), false, 'unverified member shows a verified badge');
    await page.getByRole('button', { name: '공개 프로필 미리보기', exact: true }).click();
    const mePreview = page.getByRole('dialog', { name: '내 공개 프로필 미리보기', exact: true });
    assert.equal(await mePreview.locator('img').first().getAttribute('src'), avatar, 'preview photo differs from Me');
    await mePreview.getByRole('button', { name: 'Me로 돌아가기' }).click();
    await page.screenshot({ path: `${out}/step2-me-new-member-mobile.png`, fullPage: true });

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-demo-role]').textContent(), '박*준');
    const saved = (await stored(page)).data.users.find(user => user.phone === '01098765432');
    assert.equal(saved.birthDate, '1996-05-20');
    assert.equal(saved.sugarContent, 15);
    assert.equal(saved.isPhoneVerified, false);
    assert.equal(saved.joinRoute, 'work_email');
    assert.ok(saved.avatar.startsWith('data:image/jpeg') && saved.avatar.length < 300000, 'photo stored as small resized image');
    assert.equal(await page.locator('[data-my-avatar]').getAttribute('src'), avatar, 'photo lost after reload');
    return '13 digits typed/pasted→11, wrong OTP, empty/jamo/latin name, future/under-19 birth date, missing gender, referral empty, free mail, wrong email code; gif/10MB+1/corrupt photo, next without photo, unsaved preview, save→delete→re-register; hobby/trait required; bio 301 and phone contact rejected; preview matches Me and hides name/phone/birth/email; sugar 15, 인증 전, 0회 after reload';
  });

  await run('P2', 'incomplete profile returns to the first missing step from apply, bar and Me', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await quickSignup(page, { phone: '01055556666', name: '김하늘', birth: '2000-03-03' });
    await page.getByRole('button', { name: '나중에 이어서 하기' }).click();
    await page.locator('[data-profile-incomplete-bar]').waitFor();
    await page.locator('#nav-tab-explore').click();
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    await page.getByRole('dialog', { name: '동행 공고 상세', exact: true }).getByRole('button', { name: /참여 신청/ }).click();
    await editor(page).waitFor();
    assert.match(await editor(page).locator('h3').innerText(), /1\/4 프로필 사진/);
    assert.match(await page.getByRole('alert').filter({ hasText: '동행 신청 전에' }).innerText(), /남은 단계: 사진 · 취미·성향 · 소개/);
    assert.equal(await page.getByRole('dialog', { name: '동행 참여 신청' }).count(), 0, 'request form opened with incomplete profile');
    await uploadAndSavePhoto(page);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '나중에 이어서 하기' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('[data-profile-incomplete-bar]').innerText(), /남은 단계 취미·성향 · 소개/);
    await page.locator('#nav-tab-me').click();
    assert.match(await page.locator('[data-profile-incomplete]').innerText(), /남은 단계: 취미·성향 · 소개/);
    await page.getByRole('button', { name: '프로필 이어서 작성' }).click();
    assert.match(await editor(page).locator('h3').innerText(), /2\/4 취미·성향/);
    return 'apply blocked → setup at photo; after saving photo and leaving, reload resumes at 취미·성향 from bar and Me';
  });

  await run('P3', 'post → author summary → profile A expand / B scroll, back to post, favorite saved privately', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-demo-yumi"]').click();
    await closePanel(page);
    await page.locator('#nav-tab-explore').click();
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    const post = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    const summary = await post.locator('[data-author-id="user-seojin"]').innerText();
    assert.match(summary, /서\*진/);
    assert.match(summary, /당도 81/);
    await post.locator('[data-author-id="user-seojin"]').click();
    const profile = page.locator('[data-profile-id="user-seojin"]');
    await profile.waitFor();
    assert.equal(await profile.getAttribute('data-profile-variant'), 'A');
    assert.equal(await profile.getByRole('heading', { name: '나의 성향' }).count(), 0, 'A shows details before expand');
    const expand = profile.getByRole('button', { name: /상세 펼치기/ });
    assert.equal(await expand.getAttribute('aria-expanded'), 'false');
    await expand.click();
    await profile.getByRole('heading', { name: '나의 성향' }).waitFor();
    assert.equal(await profile.getByRole('button', { name: /상세 접기/ }).getAttribute('aria-expanded'), 'true');
    const textA = await profile.innerText();
    for (const secret of ['서유진', '01000000002']) assert.equal(textA.includes(secret), false, `profile leaks ${secret}`);
    assert.match(textA, /종로구 삼청동 · 20대/);
    await page.screenshot({ path: `${out}/step2-profile-A-mobile.png` });
    await profile.getByRole('button', { name: /관심친구로 저장/ }).click();
    assert.equal(await profile.getByRole('button', { name: /관심친구 저장됨/ }).getAttribute('aria-pressed'), 'true');
    await profile.getByRole('button', { name: '공고로 돌아가기' }).click();
    await profile.waitFor({ state: 'detached' });
    await post.waitFor();
    assert.equal(await post.locator('[data-author-id="user-seojin"]').evaluate(element => document.activeElement === element), true, 'focus not returned to author');
    await post.getByRole('button', { name: '공고 상세 닫기' }).click();

    await openPanel(page);
    await panel(page).getByRole('radiogroup', { name: /02 상대 프로필/ }).getByRole('radio', { name: 'B안' }).click();
    await closePanel(page);
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    await post.locator('[data-author-id="user-seojin"]').click();
    await profile.waitFor();
    assert.equal(await profile.getAttribute('data-profile-variant'), 'B');
    await profile.getByRole('heading', { name: '나의 성향' }).waitFor();
    assert.equal(await profile.getByRole('button', { name: /상세 펼치기/ }).count(), 0);
    assert.equal(await profile.getByRole('button', { name: /관심친구 저장됨/ }).getAttribute('aria-pressed'), 'true', 'favorite lost between A/B');
    await page.screenshot({ path: `${out}/step2-profile-B-mobile.png` });
    await page.keyboard.press('Escape');
    await profile.waitFor({ state: 'detached' });
    await post.waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    const data = (await stored(page)).data;
    assert.deepEqual(data.favorites.map(item => [item.ownerId, item.targetId]), [['user-demo-yumi', 'user-seojin']]);
    assert.equal(data.notifications.some(item => item.recipientId === 'user-seojin'), false, 'saved person was notified');
    return 'A summary→expand, B continuous; back and Escape return to post with focus; favorite kept across A/B and reload, no notification to target';
  });

  await run('P4', 'chat and received-request entry points open the same user profile', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-demo-yumi"]').click();
    await closePanel(page);
    await page.locator('#nav-tab-chat').click();
    await page.locator('[data-room-id="room-req-sent-demo"]').click();
    await page.getByRole('button', { name: '서*진님의 상세 프로필 보기' }).click();
    const fromChat = page.locator('[data-profile-id="user-seojin"]');
    await fromChat.waitFor();
    const chatSugar = await fromChat.locator('[data-profile-sugar]').innerText();
    const chatBasics = await fromChat.locator('[data-profile-basics]').innerText();
    assert.match(chatSugar, /당도 81/);
    await fromChat.getByRole('button', { name: '이전 화면으로 돌아가기' }).click();
    await page.locator('#nav-tab-me').click();
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    await page.getByRole('button', { name: '김*수님의 상세 프로필 보기' }).first().click();
    const fromRequest = page.locator('[data-profile-id="user-req-1"]');
    await fromRequest.waitFor();
    assert.match(await fromRequest.locator('[data-profile-sugar]').innerText(), /당도 78/);
    await fromRequest.getByRole('button', { name: '이전 화면으로 돌아가기' }).click();
    // Same person from the post author summary.
    await page.locator('#nav-tab-explore').click();
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    await page.locator('[data-author-id="user-seojin"]').click();
    const fromPost = page.locator('[data-profile-id="user-seojin"]');
    assert.equal(await fromPost.locator('[data-profile-sugar]').innerText(), chatSugar);
    assert.equal(await fromPost.locator('[data-profile-basics]').innerText(), chatBasics);
    await page.screenshot({ path: `${out}/step2-profile-A-desktop.png` });
    return 'chat header, Me received request and post author all open the same userId profile with identical sugar/basics';
  }, { width: 1280, height: 900 });

  await run('P5', 'a new member seen by the host: sugar 15, no badge, saved photo/bio, no private data', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await quickSignup(page, { phone: '01077778888', name: '이하람', birth: '1999-07-07' });
    const bio = '사진전 좋아하는 새 회원이에요. 천천히 함께 봐요.';
    await completeProfile(page, bio);
    const me = (await stored(page)).data.users.find(user => user.phone === '01077778888');
    await page.locator('#nav-tab-explore').click();
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    await page.getByRole('dialog', { name: '동행 공고 상세', exact: true }).getByRole('button', { name: /참여 신청/ }).click();
    await page.getByRole('dialog', { name: '동행 참여 신청', exact: true }).locator('textarea').fill('사진전을 함께 보고 싶어요.');
    await page.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
    await page.getByRole('region', { name: '동행 대화방', exact: true }).waitFor();
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-seojin"]').click();
    await closePanel(page);
    await page.locator('#nav-tab-me').click();
    await page.getByRole('tab', { name: /받은 신청/ }).click();
    await page.getByRole('button', { name: '이*람님의 상세 프로필 보기' }).click();
    const profile = page.locator(`[data-profile-id="${me.id}"]`);
    await profile.waitFor();
    const text = await profile.innerText();
    assert.match(await profile.locator('[data-profile-sugar]').innerText(), /당도 15$/);
    assert.equal(await profile.locator('[data-verification]').getAttribute('data-verification'), 'none');
    assert.equal(await profile.locator('img').first().getAttribute('src'), me.avatar);
    assert.ok(text.includes(bio) || text.includes(bio.slice(0, 10)), 'bio missing');
    assert.match(text, /20대/);
    for (const secret of ['이하람', '01077778888', '1999-07-07']) assert.equal(text.includes(secret), false, `leaks ${secret}`);
    assert.equal(text.includes('예시 프로필'), false, 'new member labelled as sample');
    return 'host 서*진 opens new applicant: sugar 15, 인증 전, same stored photo and bio, age band only';
  });

  await run('P6', 'Me edit: validation, public preview, save persists, discard guard, partner sees the same bio', async page => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-demo-yumi"]').click();
    await closePanel(page);
    await page.locator('#nav-tab-me').click();
    await page.getByRole('button', { name: '프로필 편집', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '프로필 편집', exact: true });
    await edit.waitFor();
    await edit.locator('[data-photo-state="saved"]').waitFor();
    await edit.locator('#profile-bio').fill('가'.repeat(301));
    await edit.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expectAlert(edit, /300자 이하/);
    await edit.locator('#profile-bio').fill('인스타 아이디로 연락 주세요');
    await edit.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expectAlert(edit, /연락처/);
    const bio = '주말마다 새로 생긴 디저트 카페를 찾아다녀요. 편하게 이야기 나눠요.';
    await edit.locator('#profile-bio').fill(bio);
    await edit.getByRole('button', { name: '공개 미리보기', exact: true }).click();
    const preview = page.getByRole('dialog', { name: '내 공개 프로필 미리보기', exact: true });
    assert.ok((await preview.innerText()).includes(bio), 'preview does not show the draft bio');
    await preview.getByRole('button', { name: '편집으로 돌아가기' }).click();
    await edit.getByRole('button', { name: '변경 저장', exact: true }).click();
    await edit.waitFor({ state: 'detached' });
    await page.reload({ waitUntil: 'networkidle' });
    assert.ok((await page.locator('main').innerText()).includes(bio), 'saved bio lost after reload');

    // Unsaved edits ask before being thrown away.
    await page.getByRole('button', { name: '프로필 편집', exact: true }).click();
    await edit.locator('#profile-bio').fill('버릴 내용이에요');
    await edit.getByRole('button', { name: '프로필 편집 닫기' }).click();
    await edit.getByRole('alertdialog', { name: '편집 취소 확인' }).getByRole('button', { name: '변경 버리기' }).click();
    await edit.waitFor({ state: 'detached' });
    const me = await page.locator('main').innerText();
    assert.ok(me.includes(bio) && !me.includes('버릴 내용이에요'), 'discarded edit was saved');

    // The partner sees the saved bio through the chat entry point.
    await openPanel(page);
    await panel(page).locator('[data-demo-user="user-seojin"]').click();
    await closePanel(page);
    await page.locator('#nav-tab-chat').click();
    await page.locator('[data-room-id="room-req-sent-demo"]').click();
    await page.getByRole('button', { name: /조\*미님의 상세 프로필 보기/ }).click();
    const partner = page.locator('[data-profile-id="user-demo-yumi"]');
    await partner.waitFor();
    assert.ok((await partner.innerText()).includes(bio), 'partner sees a different bio');
    return 'bio 301 and messenger id rejected on save; preview shows draft; saved bio survives reload; close with unsaved edit asks and discards; 서*진 sees the same bio from chat';
  });

  await browser.close();
  if (result.externalRequests.length) result.cases.push({ id: 'P-external', name: 'no external requests', status: 'FAIL', details: result.externalRequests.join(', ') });
  fs.writeFileSync(`${out}/step2-profile.json`, JSON.stringify(result, null, 2));
  const failed = result.cases.filter(item => item.status !== 'PASS').length + result.errors.length;
  console.log(JSON.stringify({ cases: result.cases.length, failed, errors: result.errors }));
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
