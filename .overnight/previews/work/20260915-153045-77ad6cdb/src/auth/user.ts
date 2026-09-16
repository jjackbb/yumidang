import type { User } from '@supabase/supabase-js';
import type { CurrentUser } from '../types.ts';
import { NEW_USER_SUGAR } from '../data/publicProfiles.ts';
import { maskRealName } from '../utils/maskName.ts';

const text = (value: unknown) => typeof value === 'string' ? value : '';
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

/** Call only with a server-validated Auth user. Metadata supplies display fields, never permissions. */
export function currentUserFromAuth(user: User): CurrentUser {
  const meta = user.user_metadata || {};
  const name = text(meta.realName);
  const masked = name ? maskRealName(name) : '유미당 회원';
  return {
    id: user.id, isLoggedIn: true, email: user.email, phone: user.phone || '',
    realName: name, maskedName: masked, nickname: masked,
    gender: meta.gender === 'female' || meta.gender === 'male' ? meta.gender : 'undisclosed',
    ageGroup: text(meta.ageGroup), neighborhood: text(meta.neighborhood),
    sugarContent: NEW_USER_SUGAR, isPhoneVerified: Boolean(user.phone && user.phone_confirmed_at),
    isKycVerified: false, isSample: false,
    avatar: text(meta.avatar), bio: text(meta.bio), hobbies: strings(meta.hobbies), traits: strings(meta.traits),
    joinedAt: user.created_at?.slice(0, 7).replace('-', '.') || '',
  };
}
