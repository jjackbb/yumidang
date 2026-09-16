import type { Appointment, CompletionConfirmation, FavoriteFriend, NotificationSettings } from '../types.ts';

/** A real past meetup: completed, or both participants confirmed completion. */
export function hasMetBefore(
  userId: string,
  otherId: string,
  appointments: Appointment[],
  completions: CompletionConfirmation[] = [],
) {
  return appointments.some(item => {
    if (!item.participantIds?.includes(userId) || !item.participantIds.includes(otherId)) return false;
    if (item.status === '동행 완료') return true;
    const confirmed = new Set(completions.filter(entry => entry.appointmentId === item.id).map(entry => entry.userId));
    return confirmed.has(userId) && confirmed.has(otherId);
  });
}

export const isSavedBy = (ownerId: string, targetId: string, favorites: FavoriteFriend[]) =>
  favorites.some(item => item.ownerId === ownerId && item.targetId === targetId);

/** Always judged from the recipient's side. A stranger is not saved AND not met. */
export function relationToSender(
  recipientId: string,
  senderId: string,
  favorites: FavoriteFriend[],
  appointments: Appointment[],
  completions: CompletionConfirmation[] = [],
) {
  const isFavorite = isSavedBy(recipientId, senderId, favorites);
  const metBefore = hasMetBefore(recipientId, senderId, appointments, completions);
  return { isFavorite, hasMetBefore: metBefore, isStranger: !isFavorite && !metBefore };
}

export const defaultNotificationSettings = (userId: string): NotificationSettings => ({ userId, strangerInvitations: true });

export const notificationSettingsFor = (settings: NotificationSettings[], userId: string) =>
  settings.find(item => item.userId === userId) || defaultNotificationSettings(userId);
