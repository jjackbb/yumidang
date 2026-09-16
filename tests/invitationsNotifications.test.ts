import test from 'node:test';
import assert from 'node:assert/strict';
import type { Appointment, FavoriteFriend, Invitation, MeetupPost, NotificationItem } from '../src/types.ts';
import { canInviteToPost, invitationRelation, invitationStatusForPost, shouldNotifyInvitation, sortInvitations } from '../src/utils/invitations.ts';
import { sortAndFilterNotifications } from '../src/utils/notifications.ts';

const invitation = (id: string, senderId: string, postId: string, receivedAt: string): Invitation => ({ id, senderId, recipientId: 'me', postId, receivedAt, status: 'received' });
const post = (id: string, authorId: string, startsAt: string, status: MeetupPost['status'] = 'recruiting'): MeetupPost => ({
  id, authorId, author: authorId, title: id, category: '산책', avatar: '', time: '', location: '', tags: [], currentMembers: 1, maxMembers: 2,
  startsAt, endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(), recruitmentEndsAt: startsAt, status,
});
const completed = (id: string, partner: string): Appointment => ({
  id, participantIds: ['me', partner], status: '동행 완료', dDay: '', appointmentBadge: '', title: '', dateTime: '', location: '', partnerName: '', partnerAvatar: '', partnerRating: 0, partnerBio: '', menuRecommendation: '', addressDetail: '', confirmedGuests: 2, totalGuests: 2,
});

test('latest invitations pin recipient favorites, while time order ignores favorite pinning', () => {
  const items = [
    invitation('new-stranger', 'stranger', 'late', '2099-01-04T00:00:00Z'),
    invitation('old-favorite', 'favorite', 'middle', '2099-01-01T00:00:00Z'),
    invitation('new-favorite', 'both', 'early', '2099-01-03T00:00:00Z'),
    invitation('met-only', 'met', 'same', '2099-01-02T00:00:00Z'),
  ];
  const posts = [post('late', 'stranger', '2099-02-04T10:00:00Z'), post('middle', 'favorite', '2099-02-02T10:00:00Z'), post('early', 'both', '2099-02-01T10:00:00Z'), post('same', 'met', '2099-02-01T10:00:00Z')];
  const favorites: FavoriteFriend[] = [
    { ownerId: 'me', targetId: 'favorite', savedAt: '', notifyNewPosts: true },
    { ownerId: 'me', targetId: 'both', savedAt: '', notifyNewPosts: true },
  ];
  const appointments = [completed('a1', 'both'), completed('a2', 'met')];
  assert.deepEqual(sortInvitations(items, posts, 'me', favorites, appointments, [], 'latest').map(item => item.id), ['new-favorite', 'old-favorite', 'new-stranger', 'met-only']);
  assert.deepEqual(sortInvitations(items, posts, 'me', favorites, appointments, [], 'start').map(item => item.id), ['met-only', 'new-favorite', 'old-favorite', 'new-stranger']);
  assert.deepEqual(invitationRelation(items[2], 'me', favorites, appointments), { isFavorite: true, hasMetBefore: true, isStranger: false });
  assert.deepEqual(invitationRelation(items[0], 'me', favorites, appointments), { isFavorite: false, hasMetBefore: false, isStranger: true });
});

test('stranger alert switch affects notification only; saved or prior companions still alert', () => {
  const settings = [{ userId: 'me', strangerInvitations: false }];
  const saved: FavoriteFriend[] = [{ ownerId: 'me', targetId: 'saved', savedAt: '', notifyNewPosts: true }];
  const met = [completed('a', 'met')];
  assert.equal(shouldNotifyInvitation(invitation('1', 'new', 'p', ''), settings, saved, met), false);
  assert.equal(shouldNotifyInvitation(invitation('2', 'saved', 'p', ''), settings, saved, met), true);
  assert.equal(shouldNotifyInvitation(invitation('3', 'met', 'p', ''), settings, saved, met), true);
  assert.equal([invitation('1', 'new', 'p', '')].length, 1, 'the received invitation remains in Me');
});

test('invite validation and old invitation destinations preserve current post state', () => {
  const open = post('p', 'host', '2099-02-01T10:00:00Z');
  const now = new Date('2099-01-01T00:00:00Z');
  assert.equal(canInviteToPost(open, 'host', 'guest', [], false, now).ok, true);
  const existing: Invitation = { ...invitation('i', 'host', 'p', ''), recipientId: 'guest' };
  assert.match(canInviteToPost(open, 'host', 'guest', [existing], false, now).reason, /이미/);
  assert.equal(canInviteToPost(open, 'guest', 'host', [], false, now).ok, false);
  assert.equal(canInviteToPost(open, 'host', 'guest', [], true, now).ok, false);
  assert.equal(invitationStatusForPost(existing, { ...open, status: 'deleted' }), 'post_deleted');
  assert.equal(invitationStatusForPost(existing, { ...open, status: 'expired' }), 'post_expired');
  assert.equal(invitationStatusForPost(existing, { ...open, status: 'closed' }), 'post_closed');
});

test('notifications filter by kind and sort by created time without dropping legacy items', () => {
  const items = [
    { id: 'legacy', type: 'matching' },
    { id: 'old', type: 'invitation', createdAt: '2099-01-01T00:00:00Z' },
    { id: 'new', type: 'new_post', createdAt: '2099-01-02T00:00:00Z' },
    { id: 'chat', type: 'chat', createdAt: '2099-01-03T00:00:00Z' },
  ] as NotificationItem[];
  assert.deepEqual(sortAndFilterNotifications(items, 'all').map(item => item.id), ['chat', 'new', 'old', 'legacy']);
  assert.deepEqual(sortAndFilterNotifications(items, 'invitation').map(item => item.id), ['new', 'old']);
  assert.deepEqual(sortAndFilterNotifications(items, 'matching').map(item => item.id), ['legacy']);
});
