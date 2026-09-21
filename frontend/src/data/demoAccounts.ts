import type { CurrentUser } from '../types.ts';
import { DEMO_USER_ID } from './demoIdentity.ts';
import { sampleProfiles } from './publicProfiles.ts';

const AVATARS = {
  yumi: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  seojin: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  minsu: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
  hoon: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  sol: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
};

// Sample existing members for role switching. Real names and phones are fictional and never public.
const account = (id: string, realName: string, maskedName: string, gender: CurrentUser['gender'], avatar: string, phone: string): CurrentUser => {
  const sample = sampleProfiles[id];
  return {
    id, isLoggedIn: true, phone, realName, maskedName, nickname: maskedName, gender,
    ageGroup: sample.ageGroup, neighborhood: sample.neighborhood, bio: sample.bio,
    hobbies: sample.hobbies, traits: sample.traits, sugarContent: sample.sugarContent ?? 0,
    isPhoneVerified: true, isKycVerified: false, avatar, joinedAt: '예시 계정', isSample: true,
  };
};

export const demoAccounts = (): CurrentUser[] => [
  account(DEMO_USER_ID, '조유미', '조*미', 'female', AVATARS.yumi, '01000000001'),
  account('user-seojin', '서유진', '서*진', 'female', AVATARS.seojin, '01000000002'),
  account('user-req-1', '김민수', '김*수', 'male', AVATARS.minsu, '01000000003'),
  account('user-hoon', '강지훈', '강*훈', 'male', AVATARS.hoon, '01000000004'),
  account('user-sol', '윤하솔', '윤*솔', 'female', AVATARS.sol, '01000000005'),
];

export const demoAccount = (id: string) => demoAccounts().find(user => user.id === id);
