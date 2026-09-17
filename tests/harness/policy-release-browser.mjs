// Follow-up browser assertion for a full-cycle fixture whose 24h hold was advanced by an operator test.
import assert from 'node:assert/strict';
import { ensureAppServer, launchBrowser, newMemberPage, uiLogin } from './helpers/browser.mjs';
import { PERSONAS, persona } from './helpers/sessions.mjs';

const runId = process.env.POLICY_RUN_ID;
if (!runId) throw new Error('POLICY_RUN_ID is required');

const a = await persona('A');
const post = await a.sdk.from('posts').select('id').eq('title', `[${runId}] A 전체사이클 공고`).single();
if (post.error) throw post.error;
const appointment = await a.sdk.from('appointments').select('id,join_request_id').eq('post_id', post.data.id).single();
if (appointment.error) throw appointment.error;

for (const member of [await persona('A'), await persona('B')]) {
  const state = await member.sdk.rpc('get_appointment_review_state', { p_appointment_id: appointment.data.id }).single();
  assert.equal(state.error, null, state.error?.message);
  assert.equal(state.data.released, true);
  assert.equal(state.data.release_reason, 'mutual');
  assert.ok(state.data.peer_review?.comment?.includes(runId));
}

const server = await ensureAppServer();
const browser = await launchBrowser();
try {
  for (const name of ['A', 'B']) {
    const member = await newMemberPage(browser, server.url, name);
    await uiLogin(member, PERSONAS[name].phone);
    await member.page.locator('#nav-tab-chat').click();
    const room = member.page.locator(`[data-room-id="room-${appointment.data.join_request_id}"]`);
    await room.waitFor({ timeout: 30000 });
    await room.click();
    const button = member.page.getByRole('button', { name: '공개된 후기 보기' }).first();
    await button.waitFor({ timeout: 30000 });
    await button.click();
    const dialog = member.page.getByRole('dialog', { name: '동행 평가' });
    const peer = name === 'A' ? 'B' : 'A';
    await dialog.getByText(`${peer} 평가 한마디 ${runId}`, { exact: true }).waitFor({ timeout: 20000 });
    await member.context.close();
  }

  const oneSidedPost = await a.sdk.from('posts').select('id').eq('title', '[policy-one-sided-20260917T0115] 단독평가 기한공개').single();
  if (oneSidedPost.error) throw oneSidedPost.error;
  const oneSidedAppointment = await a.sdk.from('appointments').select('id,join_request_id').eq('post_id', oneSidedPost.data.id).single();
  if (oneSidedAppointment.error) throw oneSidedAppointment.error;
  const [authorState, peerState] = await Promise.all([
    (await persona('A')).sdk.rpc('get_appointment_review_state', { p_appointment_id: oneSidedAppointment.data.id }).single(),
    (await persona('B')).sdk.rpc('get_appointment_review_state', { p_appointment_id: oneSidedAppointment.data.id }).single(),
  ]);
  for (const state of [authorState, peerState]) {
    assert.equal(state.error, null, state.error?.message);
    assert.equal(state.data.released, true);
    assert.equal(state.data.release_reason, 'deadline');
  }
  assert.equal(authorState.data.peer_review, null);
  assert.equal(peerState.data.peer_review.comment, 'A 단독 평가 policy-one-sided-20260917T0115');

  const peer = await newMemberPage(browser, server.url, 'B-one-sided');
  await uiLogin(peer, PERSONAS.B.phone);
  await peer.page.locator('#nav-tab-chat').click();
  const oneSidedRoom = peer.page.locator(`[data-room-id="room-${oneSidedAppointment.data.join_request_id}"]`);
  await oneSidedRoom.waitFor({ timeout: 30000 });
  await oneSidedRoom.click();
  const activeOneSidedRoom = peer.page.locator(`[data-active-room="room-${oneSidedAppointment.data.join_request_id}"]`);
  await activeOneSidedRoom.getByRole('button', { name: '공개된 후기 보기' }).click();
  const oneSidedDialog = peer.page.getByRole('dialog', { name: '동행 평가' });
  await oneSidedDialog.waitFor({ timeout: 20000 });
  const oneSidedText = await oneSidedDialog.innerText();
  assert.ok(oneSidedText.includes('A 단독 평가 policy-one-sided-20260917T0115'), `one-sided review missing from dialog: ${oneSidedText}`);
  await peer.context.close();
  console.log(`policy-release-browser: PASS (${runId})`);
} finally {
  await browser.close();
  server.stop();
}
