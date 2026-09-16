import React, { useState } from 'react';
import { ChevronRight, Clock3, Star, UsersRound } from 'lucide-react';
import type { Appointment, CompletionConfirmation, FavoriteFriend, Invitation, MeetupPost } from '../types';
import { invitationRelation, invitationStatusForPost, sortInvitations, type InvitationSort } from '../utils/invitations';

const statusLabel: Record<Invitation['status'], string> = {
  received: '새 초대', viewed: '확인함', applied: '직접 신청함',
  post_closed: '모집 마감', post_expired: '모집 기간 만료', post_deleted: '삭제된 공고',
};

interface Props {
  userId: string;
  invitations: Invitation[];
  posts: MeetupPost[];
  favorites: FavoriteFriend[];
  appointments: Appointment[];
  completions: CompletionConfirmation[];
  userNameOf: (id: string) => string;
  onOpenPost: (invitation: Invitation) => void;
  onOpenProfile: (id: string) => void;
}

export function InvitationCenter({ userId, invitations, posts, favorites, appointments, completions, userNameOf, onOpenPost, onOpenProfile }: Props) {
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [sort, setSort] = useState<InvitationSort>('latest');
  const received = invitations.filter(item => item.recipientId === userId);
  const sent = invitations.filter(item => item.senderId === userId);
  const visible = tab === 'received'
    ? sortInvitations(received, posts, userId, favorites, appointments, completions, sort)
    : [...sent].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));

  return <section aria-label="초대 관리" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
    <div className="flex items-center gap-2"><UsersRound size={17} className="text-[#6c2cf5]" /><h2 className="text-sm font-bold">초대 관리</h2></div>
    <p className="text-[11px] text-gray-500 mt-1">초대는 신청이나 확정이 아니에요. 완성된 공고를 확인한 뒤 직접 신청하고, 작성자가 수락해야 확정돼요.</p>
    <div role="tablist" aria-label="초대 구분" className="flex gap-1.5 mt-3">
      {([['received', '받은 초대', received.length], ['sent', '보낸 초대', sent.length]] as const).map(([value, label, count]) =>
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
          className={`flex-1 rounded-xl py-2 text-xs font-bold ${tab === value ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-500'}`}>{label} {count}</button>)}
    </div>
    {tab === 'received' && <div className="mt-3 flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-500">정렬</span>
      <div className="flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="받은 초대 정렬">
        <button type="button" onClick={() => setSort('latest')} aria-pressed={sort === 'latest'} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${sort === 'latest' ? 'bg-white text-[#6c2cf5] shadow-xs' : 'text-gray-500'}`}>최신 초대순</button>
        <button type="button" onClick={() => setSort('start')} aria-pressed={sort === 'start'} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${sort === 'start' ? 'bg-white text-[#6c2cf5] shadow-xs' : 'text-gray-500'}`}>시간순</button>
      </div>
    </div>}
    <div role="tabpanel" aria-label={tab === 'received' ? '받은 초대' : '보낸 초대'} className="mt-3 space-y-2">
      {visible.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">
        {tab === 'received' ? '아직 받은 초대가 없어요.' : '아직 보낸 초대가 없어요. 관심친구 목록에서 내 공개 공고로 초대할 수 있어요.'}
      </p>}
      {visible.map(item => {
        const post = posts.find(value => value.id === item.postId);
        const currentStatus = invitationStatusForPost(item, post);
        const otherId = tab === 'received' ? item.senderId : item.recipientId;
        const relation = invitationRelation(item, userId, favorites, appointments, completions);
        const ended = currentStatus.startsWith('post_');
        return <article key={item.id} data-invitation-id={item.id} data-invitation-status={currentStatus} data-favorite={relation.isFavorite || undefined} data-met-before={relation.hasMetBefore || undefined}
          className={`rounded-xl border p-3 text-xs ${ended ? 'border-gray-100 bg-gray-50 text-gray-500' : 'border-purple-100 bg-white'}`}>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => onOpenProfile(otherId)} className="flex items-center gap-1.5 font-bold text-left">
              <span>{userNameOf(otherId)}</span>
              {relation.isFavorite && <Star aria-label="관심친구" size={13} className="fill-amber-400 text-amber-400" />}
              {relation.hasMetBefore && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">동행한 적 있음</span>}
            </button>
            <span className={`text-[11px] font-bold ${ended ? 'text-gray-400' : 'text-[#6c2cf5]'}`}>{statusLabel[currentStatus]}</span>
          </div>
          <button type="button" onClick={() => onOpenPost(item)} className="mt-2 w-full text-left flex items-center justify-between gap-2">
            <span><b className="block text-gray-800">{post?.title || '삭제된 공고'}</b><span className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"><Clock3 size={11} />{post?.time || '현재 공고 상태를 확인해 주세요.'}</span></span>
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          </button>
          {tab === 'received' && !ended && currentStatus !== 'applied' && <p className="mt-2 rounded-lg bg-purple-50 px-2.5 py-2 text-[11px] text-[#6c2cf5]">공고를 열어 조건을 확인한 뒤 ‘동행 신청하기’를 눌러주세요.</p>}
        </article>;
      })}
    </div>
  </section>;
}

