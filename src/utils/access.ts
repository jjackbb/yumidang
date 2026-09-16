import type { Appointment, CurrentUser, NotificationItem } from '../types.ts';

/** Conversations, appointments and settings are private; public posts are not. */
export const canUsePrivateArea = (user: Pick<CurrentUser, 'isLoggedIn'> | null | undefined) =>
  Boolean(user?.isLoggedIn);

/** Only participants of a confirmed or completed meetup see the detailed place. Closing a post reveals nothing. */
export function canViewSecretLocation(postId: string | undefined, appointments: Appointment[], userId: string | undefined) {
  if (!postId || !userId) return false;
  return appointments.some(item =>
    item.postId === postId &&
    item.participantIds?.includes(userId) &&
    ['매칭 확정', '매칭완료', '동행 완료'].includes(item.status),
  );
}

/** Addressed notifications are shown only to their recipient. Untargeted legacy items keep the old behavior. */
export const visibleNotifications = (items: NotificationItem[], userId: string | undefined) =>
  items.filter(item => !item.recipientId || item.recipientId === userId);
