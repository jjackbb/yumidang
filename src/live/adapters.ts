// Converts Supabase rows into the shapes the existing prototype screens already render.
// No sample values are invented: fields the backend does not have stay empty or use existing app policy defaults.
import type { Appointment, AppointmentReview, ChatMember, ChatRoom, CompletionConfirmation, JoinRequest, MeetupPost, PartnerGender } from '../types.ts';
import { formatMeetupRange } from '../utils/meetupLifecycle.ts';
import { avatarSrc } from '../utils/profile.ts';
import type { AppointmentState, AppointmentStatus, RequestStatus, ReviewState } from './api.ts';

export const NEW_USER_SUGAR_POLICY = 15; // existing app policy for real members (types.ts: 신규 가입 15)

export interface LivePostRow {
  id: string; author_id: string; title: string; description: string; category: string;
  starts_at: string; ends_at: string; recruitment_ends_at: string; public_area: string;
  preference_note: string | null; tags: string[]; status: MeetupPost['status']; partner_gender?: PartnerGender;
}
export interface AuthorCard { post_id: string; author_id: string; masked_name: string; avatar_url: string | null }
export interface JoinRow { id: string; post_id: string; requester_id: string; message: string; status: RequestStatus; created_at: string; updated_at: string }
export interface AppointmentRow { id: string; post_id: string; join_request_id: string; status: AppointmentStatus; confirmed_at: string; completed_at: string | null }
export interface MessageRow { id: string; join_request_id: string; sender_id: string; content: string; created_at: string }
export type ReviewStateRow = ReviewState;

export const avatarOrPlaceholder = (url: string | null | undefined) => avatarSrc(url || undefined);

/** Backend request status → existing screen status. */
export const REQUEST_STATUS_TO_SCREEN: Record<RequestStatus, JoinRequest['status']> = {
  pending: 'pending',
  withdrawn: 'cancelled',
  declined: 'rejected',
  matched: 'accepted',
  not_selected: 'matched_with_other',
};

export function toMeetupPost(row: LivePostRow, card: AuthorCard | undefined, exactLocation: string | null | undefined, hasAppointment: boolean): MeetupPost {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    recruitmentEndsAt: row.recruitment_ends_at,
    time: formatMeetupRange(row.starts_at, row.ends_at),
    author: card?.masked_name || '작성자',
    authorId: row.author_id,
    avatar: avatarOrPlaceholder(card?.avatar_url),
    location: row.public_area,
    publicLocation: '',
    // Present only when RLS returned it (author or confirmed companion).
    secretLocation: exactLocation || undefined,
    partnerPreferences: row.preference_note || '',
    partnerGender: row.partner_gender || 'any',
    currentMembers: hasAppointment ? 2 : 1,
    maxMembers: 2,
    tags: row.tags,
    status: row.status,
    closedReason: row.status === 'closed' && hasAppointment ? 'matched' : undefined,
    companionType: 'free',
  };
}

export function toJoinRequest(row: JoinRow, post: MeetupPost | undefined, requester: { name: string; avatar: string }): JoinRequest {
  return {
    id: row.id,
    hostId: post?.authorId || '',
    postId: row.post_id,
    postTitle: post?.title || '',
    requesterId: row.requester_id,
    requesterName: requester.name,
    requesterAvatar: requester.avatar,
    requesterSugar: NEW_USER_SUGAR_POLICY,
    message: row.message,
    status: REQUEST_STATUS_TO_SCREEN[row.status],
    createdAt: row.created_at,
  };
}

export function toAppointment(row: AppointmentRow, post: MeetupPost, request: JoinRequest, viewerId: string, partner: ChatMember, state?: AppointmentState, review?: ReviewStateRow): Appointment {
  const screenStatus = row.status === 'completed' ? '동행 완료' : row.status === 'disputed' ? '이의 검토 중' : row.status === 'no_show' ? '불발' : row.status === 'cancelled' ? '동행 취소' : '매칭 확정';
  return {
    id: row.id,
    postId: row.post_id,
    scheduledAt: post.startsAt,
    endsAt: post.endsAt,
    participantIds: [post.authorId!, request.requesterId],
    status: screenStatus,
    dDay: row.status === 'completed' ? '완료됨' : '',
    appointmentBadge: '1:1 매칭 확정',
    title: post.title,
    dateTime: post.time,
    location: post.location,
    addressDetail: post.secretLocation || post.location,
    partnerName: partner.displayName,
    partnerAvatar: partner.avatar,
    partnerRating: 0,
    partnerBio: '',
    menuRecommendation: post.category,
    confirmedGuests: 2,
    totalGuests: 2,
    companionType: 'free',
    livePolicy: state ? {
      completionMethod: state.completion_method,
      completionNotifiedAt: state.completion_notified_at,
      disputeDeadlineAt: state.dispute_deadline_at,
      completedByMe: state.completed_by_me,
      canComplete: state.can_confirm_completion,
      canDispute: state.can_dispute,
      disputeStatus: state.dispute_status,
      reviewDeadlineAt: review?.deadline_at || null,
      reviewHoldUntil: review?.hold_until || null,
      reviewDisputed: review?.disputed || false,
      reviewCanWrite: review?.can_write || false,
      reviewsReleased: review?.released || false,
      reviewReleaseReason: review?.release_reason || null,
    } : undefined,
  };
}

export function toChatRoom(request: JoinRequest, post: MeetupPost | undefined, host: ChatMember, requester: ChatMember, messages: MessageRow[], appointmentId?: string): ChatRoom {
  return {
    id: `room-${request.id}`,
    requestId: request.id,
    appointmentId,
    postId: request.postId,
    postTitle: post?.title || request.postTitle,
    members: [host, requester],
    draft: '',
    messages: [
      // The request introduction is shown as the first bubble; it is not copied into chat_messages.
      { id: `intro-${request.id}`, senderId: request.requesterId, text: request.message, createdAt: request.createdAt },
      ...messages.map(message => ({ id: message.id, senderId: message.sender_id, text: message.content, createdAt: message.created_at })),
    ],
  };
}

export function toCompletion(row: { appointment_id: string; user_id: string; confirmed_at: string }): CompletionConfirmation {
  return { appointmentId: row.appointment_id, userId: row.user_id, confirmedAt: row.confirmed_at };
}

/**
 * Review state → review records the existing screens understand.
 * Before release the peer record carries no rating/comment (existence only), so nothing hidden can leak.
 */
export function toAppointmentReviews(state: ReviewStateRow, viewerId: string, partnerId: string): AppointmentReview[] {
  const reviews: AppointmentReview[] = [];
  if (state.own_review) reviews.push({
    id: `review-${state.appointment_id}-${viewerId}`, appointmentId: state.appointment_id, reviewerId: viewerId, revieweeId: partnerId,
    rating: state.own_review.rating, positiveItems: [], negativeItems: [], comment: state.own_review.comment || '',
    submittedAt: state.own_review.submitted_at, variant: 'A',
    released: state.released,
  });
  if (state.peer_submitted) reviews.push({
    id: `review-${state.appointment_id}-${partnerId}`, appointmentId: state.appointment_id, reviewerId: partnerId, revieweeId: viewerId,
    rating: state.released && state.peer_review ? state.peer_review.rating : 0,
    positiveItems: [], negativeItems: [],
    comment: state.released && state.peer_review ? state.peer_review.comment || '' : '',
    submittedAt: state.released && state.peer_review ? state.peer_review.submitted_at : '',
    variant: 'A',
    released: state.released,
  });
  return reviews;
}
