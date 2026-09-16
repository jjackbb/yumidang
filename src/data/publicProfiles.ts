import type { ChatMember, CurrentUser, MeetupPost, PublicUserProfile } from '../types.ts';
import { DEMO_USER_ID } from './demoIdentity.ts';
import { ageGroupOf, avatarSrc } from '../utils/profile.ts';

/** New members start at 15. Aggregation, floor and update timing are pending policy. */
export const NEW_USER_SUGAR = 15;

type SampleProfile = Pick<PublicUserProfile, 'bio' | 'neighborhood' | 'ageGroup' | 'hobbies' | 'traits' | 'sugarContent'>;

// Explicit prototype fixtures. Missing user data must not turn into a verified profile.
export const sampleProfiles: Record<string, SampleProfile> = {
  'user-req-1': { bio: '디저트 카페를 함께 둘러보고 편하게 이야기 나누고 싶어요.', neighborhood: '성동구 성수동', ageGroup: '20대', hobbies: ['디저트', '카페'], traits: ['시간을 잘 지키는'], sugarContent: 78 },
  'user-req-2': { bio: '동네에서 취향이 맞는 이웃과 함께하고 싶어요.', neighborhood: '성동구 성수동', ageGroup: '30대', hobbies: ['디저트', '산책'], traits: ['배려하는'], sugarContent: 85 },
  [DEMO_USER_ID]: { bio: '새로운 카페와 디저트를 함께 즐길 이웃을 만나고 싶어요.', neighborhood: '성동구 성수동', ageGroup: '20대', hobbies: ['카페', '디저트'], traits: ['차분한', '약속을 잘 지키는'], sugarContent: 50 },
  'user-now': { bio: '커피 한 잔과 가벼운 산책을 좋아해요.', neighborhood: '성동구 성수동', ageGroup: '20대', hobbies: ['커피', '산책'], traits: ['편안한 대화'], sugarContent: 63 },
  'user-minwoo': { bio: '축제와 야외 피크닉을 좋아해요. 서로 사진도 남겨주면 좋겠어요.', neighborhood: '영등포구 여의도동', ageGroup: '30대', hobbies: ['축제', '사진'], traits: ['활발한', '계획적인'], sugarContent: 72 },
  'user-default': { bio: '브런치와 프렌치 토스트를 좋아해요. 편안하게 대화 나누어요.', neighborhood: '강남구 대치동', ageGroup: '20대', hobbies: ['맛집', '브런치'], traits: ['차분한', '배려하는'], sugarContent: 78 },
  'user-seojin': { bio: '전시는 천천히 둘러보고, 관람 후에 인상 깊었던 작품 이야기를 나누고 싶어요.', neighborhood: '종로구 삼청동', ageGroup: '20대', hobbies: ['전시', '사진', '카페'], traits: ['차분한', '이야기를 잘 듣는'], sugarContent: 81 },
  'user-hoon': { bio: '퇴근 후 한 시간 정도 걸으며 하루를 정리해요. 서로 편한 속도로 걸어요.', neighborhood: '강남구 삼성동', ageGroup: '30대', hobbies: ['산책', '반려견'], traits: ['느긋한', '시간을 잘 지키는'], sugarContent: 68 },
  'user-sol': { bio: '처음 해보는 공예도 함께 차근차근 배우는 걸 좋아해요.', neighborhood: '성동구 성수동', ageGroup: '20대', hobbies: ['공예', '원데이 클래스'], traits: ['꼼꼼한', '차분한'], sugarContent: 75 },
  'user-snap-pro': { bio: '자연스러운 표정을 사진으로 남기는 일을 좋아합니다.', neighborhood: '성동구 성수동', ageGroup: '30대', hobbies: ['사진', '골목 탐방'], traits: ['세심한'], sugarContent: 92 },
  'user-running-pro': { bio: '각자의 속도에 맞춰 함께 달리는 시간을 좋아합니다.', neighborhood: '강남구 삼성동', ageGroup: '30대', hobbies: ['러닝', '운동'], traits: ['차근차근 설명하는'], sugarContent: 91 },
};

const sampleReviews = (id: string) => [{ id: `sample-review-${id}`, author: '이*진', rating: 5, comment: '약속 시간을 지켜주셨고 서로 편한 방식으로 함께할 수 있었어요.' }];

/** Registered accounts by id; the signed-in user's current record wins over a stored copy. */
export function userDirectory(users: CurrentUser[] = [], currentUser?: CurrentUser | null): Record<string, CurrentUser> {
  const directory = Object.fromEntries(users.map(user => [user.id, user]));
  if (currentUser) directory[currentUser.id] = currentUser;
  return directory;
}

/**
 * The one public view of a user for every screen (post, request, chat, appointment).
 * Phone, real name, birth date, email and referral code are never copied into it.
 */
export function publicProfileOf(member: ChatMember, directory: Record<string, CurrentUser>): PublicUserProfile {
  const base: PublicUserProfile = {
    id: member.id, displayName: member.displayName, avatar: member.avatar,
    bio: '', neighborhood: '', ageGroup: '', hobbies: [], traits: [], sugarContent: null,
    isPhoneVerified: false, isKycVerified: false, isSample: false, reviews: [],
  };
  const account = directory[member.id];
  if (account) return {
    ...base, displayName: account.maskedName, avatar: avatarSrc(account.avatar), bio: account.bio,
    // Only the age band derived from the birth date is public, never the date itself.
    neighborhood: account.neighborhood, ageGroup: ageGroupOf(account.birthDate) || account.ageGroup,
    hobbies: account.hobbies || [], traits: account.traits || [],
    sugarContent: Number.isFinite(account.sugarContent) ? account.sugarContent : NEW_USER_SUGAR,
    isPhoneVerified: account.isPhoneVerified, isKycVerified: account.isKycVerified,
    isSample: Boolean(account.isSample) || account.id === DEMO_USER_ID,
    reviews: account.isSample && account.id !== DEMO_USER_ID && sampleProfiles[account.id] ? sampleReviews(account.id) : [],
  };
  const sample = sampleProfiles[member.id];
  if (!sample) return base;
  return { ...base, ...sample, isSample: true, isPhoneVerified: true, reviews: sampleReviews(member.id) };
}

export function publicProfileForMember(member: ChatMember, currentUser: CurrentUser | null, users: CurrentUser[] = []): PublicUserProfile {
  return publicProfileOf(member, userDirectory(users, currentUser));
}

export function publicProfileForPost(post: MeetupPost, currentUser: CurrentUser | null, users: CurrentUser[] = []): PublicUserProfile {
  return publicProfileForMember({ id: post.authorId || `unknown-${post.id}`, displayName: post.author, avatar: post.avatar }, currentUser, users);
}
