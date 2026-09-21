import type {
  Appointment,
  CompletionConfirmation,
  FavoriteFriend,
  Invitation,
  MeetupPost,
  NotificationSettings,
} from '../types.ts';
import { isRecruiting } from './postLifecycle.ts';
import { relationToSender, notificationSettingsFor } from './relations.ts';

export type InvitationSort = 'latest' | 'start';

export function invitationRelation(
  invitation: Invitation,
  viewerId: string,
  favorites: FavoriteFriend[],
  appointments: Appointment[],
  completions: CompletionConfirmation[] = [],
) {
  const otherId = invitation.recipientId === viewerId ? invitation.senderId : invitation.recipientId;
  return relationToSender(viewerId, otherId, favorites, appointments, completions);
}

const time = (value?: string) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

/** Received invitations: latest mode pins people saved by the recipient; start mode never pins. */
export function sortInvitations(
  invitations: Invitation[],
  posts: MeetupPost[],
  viewerId: string,
  favorites: FavoriteFriend[],
  appointments: Appointment[],
  completions: CompletionConfirmation[] = [],
  mode: InvitationSort = 'latest',
) {
  return invitations.map((item, index) => ({ item, index })).sort((a, b) => {
    if (mode === 'latest') {
      const favoriteA = invitationRelation(a.item, viewerId, favorites, appointments, completions).isFavorite ? 1 : 0;
      const favoriteB = invitationRelation(b.item, viewerId, favorites, appointments, completions).isFavorite ? 1 : 0;
      if (favoriteA !== favoriteB) return favoriteB - favoriteA;
      const received = time(b.item.receivedAt) - time(a.item.receivedAt);
      if (received) return received;
    } else {
      const startA = time(posts.find(post => post.id === a.item.postId)?.startsAt);
      const startB = time(posts.find(post => post.id === b.item.postId)?.startsAt);
      if (startA !== startB) return startA - startB;
      const received = time(a.item.receivedAt) - time(b.item.receivedAt);
      if (received) return received;
    }
    return a.item.id.localeCompare(b.item.id) || a.index - b.index;
  }).map(({ item }) => item);
}

/** Turning off stranger alerts never drops the invitation itself from Me. */
export function shouldNotifyInvitation(
  invitation: Invitation,
  settings: NotificationSettings[],
  favorites: FavoriteFriend[],
  appointments: Appointment[],
  completions: CompletionConfirmation[] = [],
) {
  const relation = relationToSender(invitation.recipientId, invitation.senderId, favorites, appointments, completions);
  return !relation.isStranger || notificationSettingsFor(settings, invitation.recipientId).strangerInvitations;
}

export function invitationStatusForPost(invitation: Invitation, post?: MeetupPost): Invitation['status'] {
  if (!post || post.status === 'deleted') return 'post_deleted';
  if (post.status === 'expired') return 'post_expired';
  if (post.status === 'closed') return 'post_closed';
  return invitation.status;
}

export function canInviteToPost(
  post: MeetupPost | undefined,
  senderId: string,
  recipientId: string,
  invitations: Invitation[],
  blocked: boolean,
  now = new Date(),
) {
  if (!post || post.authorId !== senderId) return { ok: false, reason: '내가 작성한 공고로만 초대할 수 있어요.' };
  if (senderId === recipientId) return { ok: false, reason: '본인은 초대할 수 없어요.' };
  if (blocked) return { ok: false, reason: '차단 관계인 회원은 초대할 수 없어요.' };
  if (!isRecruiting(post, now)) return { ok: false, reason: '모집 중인 공개 공고로만 초대할 수 있어요.' };
  if (invitations.some(item => item.postId === post.id && item.senderId === senderId && item.recipientId === recipientId))
    return { ok: false, reason: '이미 이 공고로 초대했어요.' };
  return { ok: true, reason: '' };
}

