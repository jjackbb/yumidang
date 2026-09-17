// Production Supabase verification for recipient-only join-request notifications.
// Creates attributable test rows and never deletes or rewrites existing product data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonClient, persona } from './helpers/sessions.mjs';
import { createPost, sleep } from './helpers/data.mjs';
import { subscribeInserts } from './helpers/realtime.mjs';

const runId = `ut-notification-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
const ctx = { run: { runId, guard: { protect() {} } } };
let requester;
let author;
let outsider;
let requesterSubscription;
let authorSubscription;
let outsiderSubscription;

try {
  [requester, author, outsider] = await Promise.all([persona('A'), persona('B'), persona('C')]);
  assert.equal(new Set([requester.userId, author.userId, outsider.userId]).size, 3, 'A, B and C must be distinct users');

  const post = await createPost(ctx, author, 'UT 신규 신청 알림', {
    startsInSeconds: 30 * 24 * 3600,
    durationSeconds: 3600,
    recruitmentLeadSeconds: 29 * 24 * 3600,
  });
  const anonPost = await anonClient().from('posts').select('id').eq('id', post.post.id).single();
  assert.equal(anonPost.error, null, 'existing public post retrieval must continue to work');

  const filter = `recipient_id=eq.${author.userId}`;
  [requesterSubscription, authorSubscription, outsiderSubscription] = await Promise.all([
    subscribeInserts(requester, 'notifications', filter),
    subscribeInserts(author, 'notifications', filter),
    subscribeInserts(outsider, 'notifications', filter),
  ]);
  await sleep(1000);

  const created = await requester.sdk.rpc('create_join_request', {
    p_post_id: post.post.id,
    p_message: '신규 신청 알림 권한을 확인하는 테스트 요청입니다.',
  }).single();
  assert.equal(created.error, null, created.error?.message);
  assert.equal(created.data.already_existed, false, 'test must create a new request after migration');

  await authorSubscription.waitFor(row => row.join_request_id === created.data.id);
  await sleep(2000);
  assert.equal(requesterSubscription.events.some(event => event.row.join_request_id === created.data.id), false, 'requester received the author notification');
  assert.equal(outsiderSubscription.events.some(event => event.row.join_request_id === created.data.id), false, 'third party received the author notification');

  const authorRows = await author.sdk.from('notifications').select('id,recipient_id,join_request_id,read_at').eq('join_request_id', created.data.id);
  assert.equal(authorRows.error, null);
  assert.equal(authorRows.data.length, 1);
  assert.equal(authorRows.data[0].recipient_id, author.userId);
  assert.equal(authorRows.data[0].read_at, null);
  const notificationId = authorRows.data[0].id;

  for (const member of [requester, outsider]) {
    const invisible = await member.sdk.from('notifications').select('id').eq('join_request_id', created.data.id);
    assert.equal(invisible.error, null);
    assert.deepEqual(invisible.data, []);
  }
  const anonymous = await anonClient().from('notifications').select('id').eq('join_request_id', created.data.id);
  assert.ok(anonymous.error || anonymous.data.length === 0, 'anonymous notification read was not denied');

  assert.equal((await requester.sdk.rpc('mark_my_notification_read', { p_notification_id: notificationId })).error, null);
  assert.equal((await outsider.sdk.rpc('mark_all_my_notifications_read')).error, null);
  const stillUnread = await author.sdk.from('notifications').select('read_at').eq('id', notificationId).single();
  assert.equal(stillUnread.error, null);
  assert.equal(stillUnread.data.read_at, null, 'another user changed the author notification');

  assert.equal((await author.sdk.rpc('mark_my_notification_read', { p_notification_id: notificationId })).error, null);
  const readByAuthor = await author.sdk.from('notifications').select('read_at').eq('id', notificationId).single();
  assert.equal(readByAuthor.error, null);
  assert.ok(readByAuthor.data.read_at, 'recipient could not mark the notification as read');

  await sleep(1000);
  assert.equal(requesterSubscription.events.some(event => event.row.id === notificationId), false, 'requester received a notification update');
  assert.equal(outsiderSubscription.events.some(event => event.row.id === notificationId), false, 'third party received a notification update');

  console.log(JSON.stringify({
    result: 'PASS',
    target: 'bndguguarijmghnkenvt',
    existingLoginAndPostRead: true,
    authorOnlySelect: true,
    authorOnlyRealtime: true,
    crossUserReadMutationBlocked: true,
    recipientReadPersisted: true,
  }));
} finally {
  await Promise.all([
    requesterSubscription?.close(), authorSubscription?.close(), outsiderSubscription?.close(),
  ].filter(Boolean));
  await Promise.all([requester, author, outsider].filter(Boolean).map(member => member.sdk.auth.signOut({ scope: 'local' }).catch(() => {})));
}
