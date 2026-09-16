export interface EventBannerItem {
  id: string;
  badge: string;
  subBadge: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  tag: string;
  startsOn: string;
  endsOn: string;
  kind: '팝업' | '전시' | '축제' | '공연';
  description: string;
  sourceType: 'sample' | 'collected';
  sourceUrl?: string;
}

export type CompanionType = 'free' | 'pro';
export type PartnerGender = 'any' | 'female' | 'male';

export interface ProDetails {
  hourlyRate: number; // 시간당 비용 (예: 25000)
  specialty: string; // 전문 분야
  curriculum: string[]; // 커리큘럼 / 활동 순서
  included: string[]; // 포함 내역
  excluded: string[]; // 불포함 내역
  portfolioPhotos?: string[];
}

export interface EscrowPayment {
  id: string;
  appointmentId?: string;
  postId: string;
  postTitle: string;
  hostName: string;
  requesterName: string;
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  status: 'held' | 'released' | 'refunded'; // held: 에스크로 예치 중, released: 동행완료 후 정산, refunded: 취소/환불
  paidAt: string;
  paymentMethod: 'kakaopay' | 'tosspay' | 'card';
}

export interface Appointment {
  id: string;
  postId?: string;
  scheduledAt?: string;
  endsAt?: string;
  participantIds?: string[];
  status: string;
  dDay: string;
  appointmentBadge: string;
  title: string;
  dateTime: string;
  location: string;
  partnerName: string;
  partnerAvatar: string;
  partnerRating: number;
  partnerBio: string;
  menuRecommendation: string;
  addressDetail: string;
  confirmedGuests: number;
  totalGuests: number;
  companionType?: CompanionType;
  proDetails?: ProDetails;
  escrowPayment?: EscrowPayment;
  cancellation?: { actorId: string; reason: string; createdAt: string };
}

export interface CategoryItem {
  id: string;
  name: string;
  iconBg: string;
  iconColor: string;
  iconType:
    | 'exhibition'
    | 'festival'
    | 'dining'
    | 'sports'
    | 'travel'
    | 'class'
    | 'walk'
    | 'study'
    | 'performance'
    | 'shopping'
    | 'flash'
    | 'other';
}

export interface MeetupPost {
  id: string;
  startsAt?: string;
  endsAt?: string;
  recruitmentEndsAt?: string;
  revision?: number;
  closedReason?: 'manual' | 'matched' | 'cancelled';
  description?: string;
  eventId?: string;
  category: string;
  title: string;
  author: string;
  authorId?: string;
  avatar: string;
  time: string;
  location: string;
  publicLocation?: string;
  secretLocation?: string;
  partnerPreferences?: string;
  /** Explicit partner condition chosen by the author. Absent on older posts means anyone. */
  partnerGender?: PartnerGender;
  currentMembers: number;
  maxMembers: number;
  tags: string[];
  status: 'recruiting' | 'closed' | 'expired' | 'deleted';
  imageUrl?: string;
  companionType?: CompanionType;
  proDetails?: ProDetails;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  avatar: string;
  bio: string;
  neighborhood: string;
  ageGroup: string;
  hobbies: string[];
  traits: string[];
  sugarContent: number | null;
  isPhoneVerified: boolean;
  isKycVerified: boolean;
  isSample: boolean;
  reviews: { id: string; author: string; rating: number; comment: string }[];
}

export type NotificationTargetType = 'post' | 'invitation' | 'room' | 'appointment' | 'review';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'matching' | 'event' | 'chat' | 'invitation' | 'new_post' | 'completion' | 'review';
  action?: 'match_requests';
  roomId?: string;
  // Absent on legacy/sample items: those stay visible to every viewer as before.
  recipientId?: string;
  createdAt?: string;
  targetType?: NotificationTargetType;
  targetId?: string;
}

export type ABVariant = 'A' | 'B';

/** One-way private save. The target is never told and never sees who saved them. */
export interface FavoriteFriend {
  ownerId: string;
  targetId: string;
  savedAt: string;
  notifyNewPosts: boolean;
}

export type InvitationStatus = 'received' | 'viewed' | 'applied' | 'post_closed' | 'post_expired' | 'post_deleted';

/** Invites to an already public post. Receiving or opening one never creates a request or match. */
export interface Invitation {
  id: string;
  postId: string;
  senderId: string;
  recipientId: string;
  receivedAt: string;
  status: InvitationStatus;
  viewedAt?: string;
}

/** Personal completion record. Each participant confirms separately from the real end time. */
export interface CompletionConfirmation {
  appointmentId: string;
  userId: string;
  confirmedAt: string;
}

/** Unique per appointmentId + reviewerId. Content stays private until both sides submit. */
export interface AppointmentReview {
  id: string;
  appointmentId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  positiveItems: string[];
  negativeItems: string[];
  comment: string;
  submittedAt: string;
  variant: ABVariant;
}

export interface NotificationSettings {
  userId: string;
  /** Invites from people the recipient neither saved nor actually met. Defaults to ON. */
  strangerInvitations: boolean;
}

export interface BlockRelation {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface DemoSettings {
  /** Added to the real clock so reviewers can move time without faking completions. */
  timeOffsetMs: number;
  variants: { profile: ABVariant; postForm: ABVariant; review: ABVariant };
}

export interface CurrentUser {
  id: string;
  isLoggedIn: boolean;
  email?: string;
  phone: string;
  realName: string;
  maskedName: string;
  nickname: string;
  gender: 'female' | 'male' | 'undisclosed';
  ageGroup: string;
  neighborhood: string;
  sugarContent: number; // 당도 (신규 가입 15, 샘플 사용자는 샘플 수치)
  isPhoneVerified: boolean;
  isKycVerified: boolean;
  avatar: string;
  bio: string;
  joinedAt: string;
  birthDate?: string;
  hobbies?: string[];
  traits?: string[];
  /** Prototype fixture account; its sugar/badges/reviews are sample values. */
  isSample?: boolean;
  referralCode?: string;
  /** Male signup route. The code/email check is a prototype example, not a real verification. */
  joinRoute?: 'referral' | 'work_email';
  isProHost?: boolean;
  proSpecialty?: string;
}

export interface JoinRequest {
  id: string;
  hostId: string;
  postId: string;
  postTitle: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  requesterSugar: number;
  message: string;
  status: 'pending' | 'reconfirming' | 'accepted' | 'rejected' | 'cancelled' | 'matched_with_other' | 'post_closed' | 'post_expired' | 'post_deleted' | 'change_declined' | 'match_cancelled';
  conditionSnapshot?: PostConditions;
  reconfirmation?: { revision: number; changes: ConditionChange[]; status: 'pending' | 'accepted' | 'declined' };
  cancellationReason?: string;
  createdAt: string;
}

export interface ChatMember { id: string; displayName: string; avatar: string }
export type PostConditions = Pick<MeetupPost, 'title' | 'category' | 'description' | 'startsAt' | 'endsAt' | 'recruitmentEndsAt' | 'location' | 'publicLocation' | 'secretLocation' | 'partnerPreferences' | 'partnerGender' | 'companionType' | 'proDetails'>;
export interface ConditionChange { label: string; before: string; after: string }
export interface ConversationMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  isSample?: boolean;
  proposal?: ScheduleProposal;
}
export interface ChatRoom {
  id: string;
  requestId?: string;
  appointmentId?: string;
  postId: string;
  postTitle: string;
  members: ChatMember[];
  messages: ConversationMessage[];
  draft: string;
}

export interface ScheduleProposal {
  id: string;
  newDateTime: string;
  startsAt?: string;
  endsAt?: string;
  newLocation: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  proposerName: string;
}

export interface PraiseBadge {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

export interface ReviewItem {
  id: string;
  appointmentId: string;
  appointmentTitle: string;
  reviewerName: string;
  reviewerAvatar: string;
  targetName: string;
  rating: number;
  badges: string[];
  comment: string;
  isBlind: boolean; // 상대방 미제출 시 true (점수/내용 잠김)
  settledAt?: string;
  createdAt: string;
}

export interface SugarHistoryItem {
  id: string;
  delta: number;
  reason: string;
  date: string;
}
