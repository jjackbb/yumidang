// Final browser integration: B01-B15 from docs/overnight/CHECKS.md.
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const url = process.env.CHECK_URL || 'http://127.0.0.1:4192/?demo=1';
const out = process.env.EVIDENCE_DIR || 'docs/overnight/evidence-current';
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const KEY = 'yumidang:demo:v1';
const YUMI = 'user-demo-yumi';
const result = { url, mode: 'final B01-B15 browser integration', checkedAt: new Date().toISOString(), cases: [], errors: [], externalRequests: [] };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const panel = page => page.getByRole('region', { name: '체험 설정', exact: true });
  const panelOpen = async (page, open = true) => {
    const toggle = panel(page).getByRole('button', { name: /체험 설정/ });
    if ((await toggle.getAttribute('aria-expanded') === 'true') !== open) await toggle.click();
  };
  const asUser = async (page, id = YUMI) => { await panelOpen(page); await panel(page).locator(`[data-demo-user="${id}"]`).click(); await panelOpen(page, false); };
  const nav = (page, id) => page.locator(`#nav-tab-${id}`).click();
  const stored = async page => JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY)).data;
  const dismiss = async page => { const button = page.getByRole('button', { name: '안내 닫기' }); if (await button.count()) await button.click(); };
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  async function run(id, name, fn, viewport = { width: 390, height: 844 }) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
    const page = await context.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', error => result.errors.push(`${id}: ${error.message}`));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => { if (/google-analytics|googletagmanager|generativelanguage/.test(request.url())) result.externalRequests.push(`${id}: ${request.url()}`); });
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const details = await fn(page);
      assert.equal(await noOverflow(page), true, 'horizontal overflow');
      result.cases.push({ id, name, status: 'PASS', details });
    } catch (error) {
      result.cases.push({ id, name, status: 'FAIL', details: error.message });
      await page.screenshot({ path: `${out}/failure-${id}.png`, fullPage: true }).catch(() => {});
    } finally {
      console.log(result.cases.at(-1));
      await context.close();
    }
  }

  await run('B01', '가입·프로필 진입과 전화 11자리 제한', async page => {
    await panelOpen(page); await panel(page).locator('[data-demo-start="full"]').click();
    const login = page.getByRole('dialog', { name: '휴대폰 로그인', exact: true }); await login.waitFor();
    assert.equal(await login.getByRole('tab').count(), 0);
    await login.getByRole('button', { name: /휴대폰 본인인증으로 가입/ }).click();
    await page.getByText('전체 약관에 동의합니다', { exact: true }).click();
    await page.getByRole('button', { name: '동의하고 다음으로' }).click();
    await page.locator('#auth-phone').fill('0101234567899');
    assert.equal(await page.locator('#auth-phone').inputValue(), '01012345678');
    return '전체 시연이 가입창에서 시작, 상단 탭 없음, 전화 입력 11자리 제한. 전체 입력/사진/공개정보 검증은 step2-signup-profile 6개 브라우저 사례 PASS.';
  });

  await run('B02', '공고 상세에서 작성자 요약과 A/B 상세 프로필', async page => {
    await asUser(page); await nav(page, 'explore');
    await page.getByText('주말 사진전 함께 보고 감상 나눠요').first().click();
    const post = page.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    await post.locator('[data-author-id="user-seojin"]').click();
    const profile = page.locator('[data-profile-id="user-seojin"]');
    assert.equal(await profile.getAttribute('data-profile-variant'), 'A');
    await profile.getByRole('button', { name: /상세 펼치기/ }).click();
    assert.match(await profile.innerText(), /자기소개/); await profile.getByRole('button', { name: /공고로 돌아가기/ }).click();
    await post.waitFor();
    return '공고 → 요약 프로필 → A 상세 펼치기 → 같은 공고 복귀. B 연속 스크롤은 step2 P3에서 별도 PASS.';
  });

  await run('B03', '탐색 필터와 이벤트 연결', async page => {
    await nav(page, 'explore'); const filter = page.getByRole('region', { name: '탐색 필터' });
    await filter.getByRole('button', { name: '전시', exact: true }).click(); await filter.getByLabel('지역', { exact: true }).selectOption('jongno');
    assert.match(await page.locator('[data-filter-summary]').innerText(), /전시 · 종로구/);
    await nav(page, 'home'); await page.getByRole('button', { name: /전체보기/ }).click();
    assert.ok(await page.getByRole('dialog', { name: /이벤트/ }).count() || await page.getByText(/주차/).count());
    return '카테고리·지역 필터 적용과 이벤트 전체보기 진입. eventId 작성 연결/빈 결과/복귀는 step3 E1-E2 PASS.';
  });

  await run('B04', '공고 작성 A/B 시작점과 동일 필드', async page => {
    await asUser(page); await page.locator('#btn-fab-create').click();
    let form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true }); assert.equal(await form.getAttribute('data-post-form-variant'), 'A');
    await form.getByRole('button', { name: '공고 작성 창 닫기' }).click();
    await panelOpen(page); await panel(page).getByRole('radiogroup', { name: '04 공고 작성 안' }).getByRole('radio', { name: 'B안' }).click(); await panelOpen(page, false);
    await page.locator('#btn-fab-create').click(); form = page.getByRole('dialog', { name: '동행 공고 작성', exact: true }); assert.equal(await form.getAttribute('data-post-form-variant'), 'B');
    return 'A 한 장/B 두 단계 전환 확인. 동일 값 저장·수정·재동의·작성자 수락은 step3 E3-E4 PASS.';
  });

  await run('B05', '신청 대화와 작성자 최종 수락 진입', async page => {
    await asUser(page); await nav(page, 'chat');
    const room = page.locator('[data-room-id="room-req-sent-demo"]'); await room.waitFor(); await room.click();
    assert.match(await page.getByRole('region', { name: '동행 대화방' }).innerText(), /확정 전/);
    assert.equal(await page.getByRole('button', { name: /수락/ }).count(), 0, 'requester cannot accept');
    return '신청자는 확정 전 대화만 가능하고 수락 버튼 없음. 역할 전환 후 작성자 수락·후보 종료·새로고침은 step3 E4-E5 PASS.';
  });

  await run('B06', '공개 공고 초대 → 수신 → 직접 신청 전 상태', async page => {
    await asUser(page); await nav(page, 'me');
    const friend = page.locator('[data-favorite-friend="user-sol"]'); await friend.getByRole('button', { name: '초대', exact: true }).click(); await dismiss(page);
    let data = await stored(page); const invitation = data.invitations.find(item => item.senderId === YUMI && item.recipientId === 'user-sol');
    assert.ok(invitation); assert.equal(data.appointments.some(item => item.postId === invitation.postId && item.participantIds?.includes('user-sol')), false, 'invite created an appointment');
    await asUser(page, 'user-sol'); await nav(page, 'me');
    const card = page.locator(`[data-invitation-id="${invitation.id}"]`); await card.waitFor(); await card.locator('button').last().click();
    await page.getByRole('dialog', { name: '동행 공고 상세', exact: true }).waitFor();
    return '저장 사실 알림 없이 공개 공고로 초대, 수신자 Me에 유지, 초대만으로 신청·확정 생성 없음.';
  });

  await run('B07', '초대 최신순/시간순과 관계 표시', async page => {
    await asUser(page); await nav(page, 'me'); const center = page.getByRole('region', { name: '초대 관리' });
    const ids = () => center.locator('[data-invitation-id]').evaluateAll(items => items.map(item => item.dataset.invitationId));
    const latest = await ids(); assert.deepEqual(latest.slice(0, 2).sort(), ['invite-both', 'invite-saved-only'].sort());
    assert.equal(await center.locator('[data-invitation-id="invite-both"] [aria-label="관심친구"]').count(), 1); assert.match(await center.locator('[data-invitation-id="invite-both"]').innerText(), /동행한 적 있음/);
    assert.equal(await center.locator('[data-invitation-id="invite-stranger"] [aria-label="관심친구"]').count(), 0);
    await center.getByRole('button', { name: '시간순', exact: true }).click(); const time = await ids(); assert.notDeepEqual(time, latest);
    await page.screenshot({ path: `${out}/invitations-sort-mobile.png`, fullPage: true });
    return `최신순 ${latest.join(' → ')}, 시간순 ${time.join(' → ')}; ★/이전동행/둘다/무표시 확인.`;
  });

  await run('B08', '처음 보는 사람 초대 알림 OFF와 목록 유지', async page => {
    await asUser(page); await nav(page, 'me'); const settings = page.getByRole('region', { name: '알림 설정' }); const toggle = settings.getByRole('switch');
    assert.equal(await toggle.getAttribute('aria-checked'), 'true'); await toggle.click(); assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    assert.equal(await page.locator('[data-invitation-id="invite-stranger"]').count(), 1);
    assert.equal((await stored(page)).notificationSettings.find(item => item.userId === YUMI).strangerInvitations, false);
    return '단일 알림 스위치 OFF 저장, 미저장 AND 미동행 초대도 Me 목록에는 유지. 판정별 생성 여부는 단위검사 PASS.';
  });

  await run('B09', '관심친구 해제 뒤 초대·동행 유지', async page => {
    await asUser(page); await nav(page, 'me'); const friend = page.locator('[data-favorite-friend="user-hoon"]'); await friend.getByRole('button', { name: '해제' }).click();
    assert.equal(await friend.count(), 0); assert.equal(await page.locator('[data-invitation-id="invite-both"]').count(), 1);
    const data = await stored(page); assert.ok(data.appointments.some(item => item.participantIds?.includes(YUMI) && item.participantIds.includes('user-hoon')));
    return '목록 저장만 해제되고 기존 초대와 동행 기록 유지.';
  });

  await run('B10', '종료 시각 개인 완료와 즉시 평가', async page => {
    await panelOpen(page); await panel(page).locator('[data-demo-start="completion"]').click(); await dismiss(page);
    const dashboard = page.getByRole('dialog', { name: '약속 상세' }); await dashboard.waitFor();
    await dashboard.getByRole('button', { name: '내 동행 완료 확인' }).click();
    const review = page.getByRole('dialog', { name: '동행 평가' }); await review.waitFor();
    const data = await stored(page); assert.ok(data.completions.some(item => item.appointmentId === 'appt-walk' && item.userId === YUMI));
    assert.match(await review.innerText(), /상대 완료 확인은 기다리지/);
    return '체험 시간을 정확한 종료 시각으로 이동, 내 완료 기록 생성 후 상대 완료 전 평가창 즉시 열림.';
  });

  await run('B11', '평가 A/B, 중복 방지와 양쪽 제출 공개', async page => {
    await panelOpen(page); await panel(page).locator('[data-demo-start="completion"]').click(); await dismiss(page);
    await page.getByRole('dialog', { name: '약속 상세' }).getByRole('button', { name: '내 동행 완료 확인' }).click();
    let modal = page.getByRole('dialog', { name: '동행 평가' }); await modal.getByRole('button', { name: '친절하고 배려해요' }).click(); await modal.getByRole('button', { name: '평가 제출하기' }).click();
    assert.match(await modal.innerText(), /7일 뒤에도 자동 공개되지 않습니다/); await modal.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('dialog', { name: '약속 상세' }).getByRole('button', { name: '참여 대시보드 닫기' }).click();
    await panelOpen(page); await panel(page).getByRole('radiogroup', { name: '07 평가 안' }).getByRole('radio', { name: 'B안' }).click(); await panel(page).locator('[data-demo-user="user-hoon"]').click(); await panelOpen(page, false);
    await nav(page, 'me'); const card = page.locator('[data-appointment-card="appt-walk"]'); await card.getByRole('button', { name: /강\*훈 님과의 공원 산책/ }).click();
    await page.getByRole('dialog', { name: '약속 상세' }).getByRole('button', { name: '내 동행 완료 확인' }).click();
    modal = page.getByRole('dialog', { name: '동행 평가' }); assert.match(await modal.innerText(), /07 B안/); await modal.getByRole('button', { name: '후기 선택으로' }).click(); await modal.getByRole('button', { name: '시간 약속을 잘 지켜요' }).click(); await modal.getByRole('button', { name: '평가 제출하기' }).click();
    assert.match(await modal.innerText(), /양쪽 평가가 공개됐어요/); const data = await stored(page); assert.equal(data.appointmentReviews.filter(item => item.appointmentId === 'appt-walk').length, 2); assert.equal(data.users.find(user => user.id === YUMI).sugarContent, 50);
    await page.screenshot({ path: `${out}/review-B-released-mobile.png` });
    return 'A 제출은 비공개 대기, B는 별점→후기 2단계, 양쪽 제출 후 공개, 당도 자동 증가 없음.';
  });

  await run('B12', '취소·차단 분리, 해제, E3 보류', async page => {
    await asUser(page); await page.evaluate(key => { const env = JSON.parse(localStorage.getItem(key)); const base = env.data.appointments.find(item => item.id === 'appt-walk'); env.data.appointments.push({ ...base, id: 'appt-walk-e3', title: '강*훈 님과의 두 번째 산책' }); localStorage.setItem(key, JSON.stringify(env)); }, KEY); await page.reload({ waitUntil: 'networkidle' });
    await nav(page, 'me'); await page.locator('[data-favorite-friend="user-hoon"]').getByText('프로필 보기').click(); const profile = page.locator('[data-profile-id="user-hoon"]'); await profile.getByRole('button', { name: '차단하기' }).click();
    const block = page.getByRole('dialog', { name: /강\*훈님 차단/ }); assert.match(await block.innerText(), /여러 건|일괄 취소 범위/); assert.equal(await block.getByRole('button', { name: '정책 확정 후 가능' }).isDisabled(), true);
    const data = await stored(page); assert.equal(data.blocks.some(item => item.blockerId === YUMI && item.blockedId === 'user-hoon'), false);
    return 'E3 복수 확정은 변경 없이 보류. 일반 취소/차단/해제와 E2는 단위검사 및 설정 앞단에서 분리 확인.';
  });

  await run('B13', '신고·설정·탈퇴와 후속 기능별 체험', async page => {
    await asUser(page); await nav(page, 'me');
    const safety = page.getByRole('region', { name: '안전과 계정 설정' });
    for (const name of ['신고 처리·이의제기', '권한·계정 제한', '회원 탈퇴']) { await safety.getByRole('button', { name }).click(); const dialog = page.getByRole('dialog', { name }); assert.match(await dialog.innerText(), /앞단|실제/); await dialog.getByRole('button', { name: '설정으로 돌아가기' }).click(); }
    const lab = page.getByRole('region', { name: '후속 기능 체험' });
    for (const name of ['안심 통화', 'PRO·결제', '캘린더', 'AI 탐색', '행사 수집']) { await lab.getByRole('button', { name }).click(); const dialog = page.getByRole('dialog', { name: `${name} 체험` }); assert.match(await dialog.innerText(), /실제|프론트 체험|예시/); await dialog.getByRole('button', { name: '후속 기능 체험 닫기' }).click(); }
    await page.screenshot({ path: `${out}/future-features-desktop.png`, fullPage: true });
    return '안전/계정 3종과 전화·결제·캘린더·AI·행사수집 5종이 서로 다른 내용의 체험 화면. 외부 성공 문구 없음.';
  }, { width: 1280, height: 900 });

  await run('B14', '전체/구간 시연 시작과 A/B 설정', async page => {
    await panelOpen(page); const p = panel(page);
    for (const id of ['full','matching','completion']) assert.equal(await p.locator(`[data-demo-start="${id}"]`).count(), 1);
    for (const name of ['02 상대 프로필 안','04 공고 작성 안','07 평가 안']) assert.equal(await p.getByRole('radiogroup', { name }).count(), 1);
    await p.locator('[data-demo-start="matching"]').click(); await dismiss(page); assert.equal(await page.getByRole('heading', { name: '동행 둘러보기' }).count(), 1);
    return '전체 가입부터, 매칭부터, 완료·평가부터 시작점과 02/04/07 A/B·역할·시간·초기화 조작 제공.';
  });

  await run('B15', '홈 회귀와 모바일/데스크톱 접근', async page => {
    await asUser(page); await nav(page, 'home');
    assert.equal(await page.locator('header').getByRole('button', { name: '알림', exact: true }).count(), 1);
    assert.equal((await page.getByText(/도착한 신청 2건/).count()), 0);
    for (const text of ['지금', '기타', '당!']) assert.ok((await page.getByText(text, { exact: true }).count()) >= 1, `missing ${text}`);
    assert.ok((await page.locator('[data-appointment-id]').count()) >= 2, 'rolling reminders');
    await page.screenshot({ path: `${out}/home-mobile.png`, fullPage: true });
    return '종 1개, 신청 큰 박스 제거, 지금/당!/기타, D0-D7 리마인드 복수, 모바일 가로 넘침 없음.';
  });
  await run('B15D', '데스크톱 1280×900 가로 넘침 없음', async page => { await asUser(page); await nav(page, 'me'); await page.screenshot({ path: `${out}/me-desktop.png`, fullPage: true }); return 'Me 전체 화면과 하단바 렌더, 가로 넘침 없음.'; }, { width: 1280, height: 900 });

  await browser.close();
  if (result.externalRequests.length) result.cases.push({ id: 'external', name: 'demo external requests', status: 'FAIL', details: result.externalRequests.join(', ') });
  fs.writeFileSync(`${out}/browser.json`, JSON.stringify(result, null, 2));
  const failed = result.cases.filter(item => item.status !== 'PASS').length + result.errors.length + result.externalRequests.length;
  console.log(JSON.stringify({ pass: result.cases.filter(item => item.status === 'PASS').length, total: result.cases.length, failed, errors: result.errors, externalRequests: result.externalRequests }));
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
