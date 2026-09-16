import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptRequest,
  createRequestRoom,
  roomAccess,
} from '../src/utils/conversations.ts';
import type { Appointment, JoinRequest, MeetupPost } from '../src/types.ts';

const post = {
  id: 'post',
  startsAt: '2099-09-18T15:00:00+09:00',
  endsAt: '2099-09-18T16:00:00+09:00',
  authorId: 'host',
  author: '작성자',
  title: '전시 동행',
  status: 'recruiting',
  avatar: '',
} as MeetupPost;
const request = {
  id: 'first',
  postId: post.id,
  hostId: 'host',
  requesterId: 'guest',
  requesterName: '신청자',
  requesterAvatar: '',
  message: '전시 후 카페도 갈까요?',
  status: 'pending',
} as JoinRequest;
const second = { ...request, id: 'second', requesterId: 'other-guest' };
const requests = [request, second];

test('applying opens a private conversation without confirming an appointment', () => {
  const room = createRequestRoom(request, post);
  assert.equal(room.appointmentId, undefined);
  assert.equal(room.messages[0].text, request.message);
  for (const id of ['host', 'guest'])
    assert.equal(roomAccess(room, id, requests, [], [post]).canSend, true);
  for (const id of [undefined, 'other-guest']) {
    const access = roomAccess(room, id, requests, [], [post]);
    assert.equal(access.canView, false);
    assert.equal(access.canSend, false);
  }
});
test('only the actual post author can accept; requester and forged host cannot', () => {
  for (const actor of [undefined, 'guest', 'other-guest'])
    assert.equal(acceptRequest(requests, post, request.id, actor), null);
  assert.equal(
    acceptRequest(
      [{ ...request, hostId: 'forged' }],
      post,
      request.id,
      'forged',
    ),
    null,
  );
  assert.equal(
    acceptRequest(
      requests,
      { ...post, id: 'another-post' },
      request.id,
      'host',
    ),
    null,
  );
});
test('one host acceptance confirms the selected request and ends other candidates', () => {
  const unrelated = { ...request, id: 'elsewhere', postId: 'another-post' };
  const accepted = acceptRequest(
    [...requests, unrelated],
    post,
    request.id,
    'host',
  )!;
  assert.deepEqual(
    accepted.map((item) => item.status),
    ['accepted', 'matched_with_other', 'pending'],
  );
  assert.equal(acceptRequest(accepted, post, request.id, 'host'), null);
  assert.equal(acceptRequest(accepted, post, second.id, 'host'), null);
  assert.equal(request.status, 'pending');
});
test('cancelled, rejected, unavailable or already matched posts cannot be accepted', () => {
  for (const status of ['cancelled', 'rejected', 'matched_with_other'] as const)
    assert.equal(
      acceptRequest([{ ...request, status }], post, request.id, 'host'),
      null,
    );
  for (const status of ['closed', 'expired'] as const)
    assert.equal(
      acceptRequest(requests, { ...post, status }, request.id, 'host'),
      null,
    );
  assert.equal(acceptRequest(requests, undefined, request.id, 'host'), null);
});
test('confirmation preserves the request room and ended candidates stay read-only', () => {
  const room = createRequestRoom(request, post);
  const accepted = acceptRequest(requests, post, request.id, 'host')!;
  const appointment = {
    id: 'appointment',
    status: '매칭 확정',
    participantIds: ['host', 'guest'],
  } as Appointment;
  const confirmedRoom = { ...room, appointmentId: appointment.id };
  assert.equal(confirmedRoom.id, room.id);
  assert.equal(confirmedRoom.messages, room.messages);
  assert.equal(
    roomAccess(
      confirmedRoom,
      'guest',
      accepted,
      [appointment],
      [{ ...post, status: 'closed' }],
    ).canSend,
    true,
  );
  const ended = roomAccess(
    createRequestRoom(second, post),
    'other-guest',
    accepted,
    [appointment],
    [post],
  );
  assert.equal(ended.canView, true);
  assert.equal(ended.canSend, false);
  assert.equal(ended.label, '다른 동행자와 확정');
});
test('termination retains history with a precise reason and no new input', () => {
  const room = createRequestRoom(request, post);
  for (const [status, label] of [
    ['cancelled', '신청 취소'],
    ['rejected', '신청 거절'],
  ] as const) {
    assert.deepEqual(
      roomAccess(room, 'guest', [{ ...request, status }], [], [post]),
      { canView: true, canSend: false, label },
    );
  }
  for (const [posts, label] of [
    [[], '삭제된 공고'],
    [[{ ...post, status: 'expired' }], '기간 만료'],
    [[{ ...post, status: 'closed' }], '모집 마감'],
  ] as [MeetupPost[], string][]) {
    assert.deepEqual(roomAccess(room, 'host', requests, [], posts), {
      canView: true,
      canSend: false,
      label,
    });
  }
});
