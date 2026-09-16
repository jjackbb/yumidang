import React, { useMemo, useState } from 'react';
import { Bell, BellOff, Heart, Send } from 'lucide-react';
import type { CurrentUser, FavoriteFriend, Invitation, MeetupPost } from '../types';
import { isRecruiting } from '../utils/postLifecycle';

interface Props {
  userId: string;
  users: CurrentUser[];
  favorites: FavoriteFriend[];
  posts: MeetupPost[];
  invitations: Invitation[];
  now: Date;
  onToggleNewPostNotice: (targetId: string) => void;
  onRemove: (targetId: string) => void;
  onInvite: (targetId: string, postId: string) => void;
  onOpenProfile: (targetId: string) => void;
}

export function FavoriteFriendsPanel({ userId, users, favorites, posts, invitations, now, onToggleNewPostNotice, onRemove, onInvite, onOpenProfile }: Props) {
  const mine = favorites.filter(item => item.ownerId === userId);
  const ownPosts = posts.filter(post => post.authorId === userId && isRecruiting(post, now));
  const initial = ownPosts[0]?.id || '';
  const [selected, setSelected] = useState<Record<string, string>>({});
  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  return <section aria-label="관심친구" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
    <div className="flex items-center gap-2"><Heart size={17} className="fill-rose-500 text-rose-500" /><h2 className="text-sm font-bold">관심친구</h2><span className="text-xs font-bold text-[#6c2cf5]">{mine.length}</span></div>
    <p className="text-[11px] text-gray-500 mt-1">저장 사실은 상대에게 알려지지 않아요. 새 공고 알림은 사람별로 끌 수 있어요.</p>
    {mine.length === 0 && <p className="py-4 text-center text-xs text-gray-400">상대 프로필에서 다시 보고 싶은 사람을 저장해 보세요.</p>}
    <div className="mt-3 space-y-3">{mine.map(favorite => {
      const person = usersById.get(favorite.targetId);
      const selectedPost = selected[favorite.targetId] ?? initial;
      const already = invitations.some(item => item.senderId === userId && item.recipientId === favorite.targetId && item.postId === selectedPost);
      return <article key={favorite.targetId} data-favorite-friend={favorite.targetId} className="rounded-xl border border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onOpenProfile(favorite.targetId)} className="min-w-0 flex-1 text-left">
            <b className="block truncate text-xs">{person?.maskedName || '회원'}</b><span className="text-[10px] text-gray-400">프로필 보기</span>
          </button>
          <button type="button" aria-pressed={favorite.notifyNewPosts} onClick={() => onToggleNewPostNotice(favorite.targetId)} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 ${favorite.notifyNewPosts ? 'bg-purple-50 text-[#6c2cf5]' : 'bg-gray-100 text-gray-500'}`}>
            {favorite.notifyNewPosts ? <Bell size={12} /> : <BellOff size={12} />} 새 공고 {favorite.notifyNewPosts ? '알림 켜짐' : '알림 꺼짐'}
          </button>
          <button type="button" onClick={() => onRemove(favorite.targetId)} className="text-[10px] text-gray-400 underline">해제</button>
        </div>
        <div className="mt-3 flex gap-2">
          <select aria-label={`${person?.maskedName || '회원'}님에게 보낼 공고`} value={selectedPost} onChange={event => setSelected(value => ({ ...value, [favorite.targetId]: event.target.value }))}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px]">
            {ownPosts.length === 0 && <option value="">모집 중인 내 공고가 없어요</option>}
            {ownPosts.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}
          </select>
          <button type="button" disabled={!selectedPost || already} onClick={() => onInvite(favorite.targetId, selectedPost)} className="shrink-0 rounded-lg bg-[#6c2cf5] px-3 py-2 text-[11px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-500 flex items-center gap-1"><Send size={12} />{already ? '초대 보냄' : '초대'}</button>
        </div>
      </article>;
    })}</div>
  </section>;
}

