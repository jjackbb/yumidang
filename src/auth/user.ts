import type { User } from '@supabase/supabase-js';

import type { CurrentUser } from '../types.ts';
import { NEW_USER_SUGAR } from '../data/publicProfiles.ts';
import { exactAgeLabel, type SignupProfile } from './signup.ts';
import { maskRealName } from '../utils/maskName.ts';
import { isProfileImagePath } from '../profile/avatarPath.ts';

export function currentUserFromProfile(user: User, profile: SignupProfile, now = new Date(), resolvedAvatar = ''): CurrentUser {
  return {
    id: profile.id,
    isLoggedIn: true,
    phone: user.phone || '',
    // The owner may see their own source name; other members only ever receive a server-masked value.
    realName: profile.real_name,
    maskedName: maskRealName(profile.real_name),
    nickname: maskRealName(profile.real_name),
    gender: profile.gender || 'undisclosed',
    birthDate: profile.birth_date,
    ageGroup: exactAgeLabel(profile.birth_date, now),
    // Activity/location data belongs to the later meetup/profile contract, not signup.
    neighborhood: '',
    sugarContent: NEW_USER_SUGAR,
    isPhoneVerified: Boolean(user.phone_confirmed_at) && user.app_metadata?.phone_ownership_verified !== false,
    isKycVerified: false,
    avatar: resolvedAvatar || (isProfileImagePath(profile.avatar_url) ? '' : profile.avatar_url || ''),
    avatarPath: isProfileImagePath(profile.avatar_url) ? profile.avatar_url : undefined,
    bio: profile.bio || '',
    hobbies: [],
    traits: [],
    joinedAt: profile.created_at,
    isSample: false,
  };
}
