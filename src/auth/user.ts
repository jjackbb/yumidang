import type { User } from '@supabase/supabase-js';

import type { CurrentUser } from '../types.ts';
import { NEW_USER_SUGAR } from '../data/publicProfiles.ts';
import { exactAgeLabel, type SignupProfile } from './signup.ts';

export function currentUserFromProfile(user: User, profile: SignupProfile, now = new Date()): CurrentUser {
  return {
    id: profile.id,
    isLoggedIn: true,
    phone: user.phone || '',
    realName: '',
    maskedName: profile.nickname,
    nickname: profile.nickname,
    gender: 'undisclosed',
    birthDate: profile.birth_date,
    ageGroup: exactAgeLabel(profile.birth_date, now),
    // Activity/location data belongs to the later meetup/profile contract, not signup.
    neighborhood: '',
    sugarContent: NEW_USER_SUGAR,
    isPhoneVerified: Boolean(user.phone_confirmed_at) && user.app_metadata?.phone_ownership_verified !== false,
    isKycVerified: false,
    avatar: profile.avatar_url || '',
    bio: profile.bio || '',
    hobbies: [],
    traits: [],
    joinedAt: profile.created_at,
    isSample: false,
  };
}
