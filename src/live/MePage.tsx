import { useCallback, useEffect, useState } from 'react';
import type { SignupProfile } from '../auth/signup';
import { exactAgeLabel } from '../auth/signup';
import { maskRealName } from '../utils/maskName';
import { liveApi, type AppointmentSummary, type Post, type ReceivedRequest, type SentRequest } from './api';
import { formatDateTime, formatRange, REQUEST_STATUS_LABEL } from './format';
import { useRealtime } from './realtime';
import { Avatar, ErrorBox, Skeleton, StatusChip } from './ui';

export function MePage({ profile, userId, onOpenChat, onOpenPost, onLogout }: {
  profile: SignupProfile; userId: string; onOpenChat: (requestId: string) => void; onOpenPost: (postId: string) => void; onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [sent, setSent] = useState<SentRequest[] | null>(null);
  const [received, setReceived] = useState<ReceivedRequest[] | null>(null);
  const [myPosts, setMyPosts] = useState<Post[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b, c, d] = await Promise.all([liveApi.sentRequests(), liveApi.receivedRequests(), liveApi.myPosts(userId), liveApi.appointments()]);
      setSent(a); setReceived(b); setMyPosts(c); setAppointments(d); setError('');
    } catch (err: any) { setError(err.message); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  useRealtime('me', [
    { table: 'join_requests', event: '*', onChange: () => void load() },
    { table: 'appointments', event: '*', onChange: () => void load() },
  ]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try { await fn(); } catch (err: any) { setError(err.message); } finally { setBusyId(null); void load(); }
  };

  return <section aria-label="내 정보" className="p-4 space-y-4 pb-28">
    <div className="flex items-center gap-3">
      <Avatar url={profile.avatar_url} label="내" size="w-14 h-14" />
      <div className="flex-1">
        <p className="font-bold text-lg"><span data-testid="me-masked-name">{maskRealName(profile.real_name)}</span> · <span data-testid="me-age">{exactAgeLabel(profile.birth_date)}</span></p>
        <p className="text-[11px] text-gray-500">다른 회원에게는 가려진 이름과 만 나이만 보여요. 실명 원본·생년월일은 나만 볼 수 있어요.</p>
      </div>
      <button type="button" disabled={loggingOut} onClick={async () => { setLoggingOut(true); try { await onLogout(); } finally { setLoggingOut(false); } }} className="text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5">로그아웃</button>
    </div>
    {error && <ErrorBox message={error} onRetry={() => void load()} />}

    <div className="space-y-2">
      <h3 className="text-sm font-bold">확정된 동행</h3>
      {!appointments ? <Skeleton rows={1} /> : appointments.length === 0 ? <p className="text-xs text-gray-500">아직 확정된 동행이 없어요.</p>
        : <ul className="space-y-2">{appointments.map(item => <li key={item.appointment_id}>
          <button type="button" onClick={() => onOpenChat(item.join_request_id)} className="w-full text-left rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs">
            <span className="flex items-center gap-1.5"><StatusChip tone="green">{item.status === 'completed' ? '동행 완료' : '확정된 동행'}</StatusChip><strong>{item.counterpart_masked_name}</strong></span>
            <span className="block mt-1 font-bold text-sm">{item.post_title}</span>
            <span className="block text-gray-500">{formatRange(item.post_starts_at, item.post_ends_at)} · {item.post_public_area}</span>
          </button></li>)}</ul>}
    </div>

    <div className="space-y-2">
      <div role="tablist" aria-label="참여 요청" className="flex gap-2">
        {(['sent', 'received'] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} type="button" onClick={() => setTab(key)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === key ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-600'}`}>{key === 'sent' ? '보낸 요청' : '받은 요청'}</button>)}
      </div>
      {tab === 'sent' && (!sent ? <Skeleton rows={2} /> : sent.length === 0 ? <p className="text-xs text-gray-500">보낸 요청이 없어요.</p> : <ul className="space-y-2">{sent.map(item => <li key={item.id} data-request-id={item.id} className="rounded-xl border border-gray-100 p-3 text-xs space-y-1">
        <div className="flex items-center gap-1.5"><StatusChip tone={item.status === 'pending' ? 'purple' : item.status === 'matched' ? 'green' : 'gray'}>{REQUEST_STATUS_LABEL[item.status]}</StatusChip><button type="button" onClick={() => onOpenPost(item.post_id)} className="font-bold text-sm text-left">{item.post_title}</button></div>
        <p className="text-gray-500">{formatRange(item.post_starts_at, item.post_ends_at)} · {item.post_public_area} · 작성자 {item.author_masked_name}</p>
        <p className="text-gray-700">“{item.message}”</p>
        <p className="text-gray-400">요청 {formatDateTime(item.created_at)}</p>
        <div className="flex gap-2"><button type="button" onClick={() => onOpenChat(item.id)} className="px-2.5 py-1.5 rounded-lg bg-[#f0edff] text-[#6c2cf5] font-bold">대화 열기</button>
          {item.status === 'pending' && <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, () => liveApi.withdrawJoinRequest(item.id))} className="px-2.5 py-1.5 rounded-lg border border-gray-200 font-bold">요청 취소</button>}</div>
      </li>)}</ul>)}
      {tab === 'received' && (!received ? <Skeleton rows={2} /> : received.length === 0 ? <p className="text-xs text-gray-500">받은 요청이 없어요.</p> : <ul className="space-y-2">{received.map(item => <li key={item.id} data-request-id={item.id} className="rounded-xl border border-gray-100 p-3 text-xs space-y-1">
        <div className="flex items-center gap-2"><Avatar url={item.requester_avatar_url} label={item.requester_masked_name} size="w-8 h-8" />
          <strong className="text-sm">{item.requester_masked_name}</strong><span className="text-gray-500">{item.requester_age !== null ? `${item.requester_age}살` : ''}</span>
          <StatusChip tone={item.status === 'pending' ? 'purple' : item.status === 'matched' ? 'green' : 'gray'}>{REQUEST_STATUS_LABEL[item.status]}</StatusChip></div>
        <p className="text-gray-500">{item.post_title}</p>
        <p className="text-gray-700">“{item.message}”</p>
        <div className="flex gap-2"><button type="button" onClick={() => onOpenChat(item.id)} className="px-2.5 py-1.5 rounded-lg bg-[#f0edff] text-[#6c2cf5] font-bold">대화 열기</button>
          {item.status === 'pending' && <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, () => liveApi.declineJoinRequest(item.id))} className="px-2.5 py-1.5 rounded-lg border border-gray-200 font-bold">요청 거절</button>}</div>
      </li>)}</ul>)}
    </div>

    <div className="space-y-2">
      <h3 className="text-sm font-bold">내가 작성한 공고</h3>
      {!myPosts ? <Skeleton rows={1} /> : myPosts.length === 0 ? <p className="text-xs text-gray-500">작성한 공고가 없어요.</p>
        : <ul className="space-y-1.5">{myPosts.map(post => <li key={post.id}><button type="button" onClick={() => onOpenPost(post.id)} className="w-full text-left rounded-xl border border-gray-100 p-2.5 text-xs">
          <StatusChip tone={post.status === 'recruiting' ? 'green' : 'gray'}>{post.status === 'closed' ? '모집 완료' : post.status === 'recruiting' ? '모집 중' : '모집 마감'}</StatusChip> <strong>{post.title}</strong>
          <span className="block text-gray-500 mt-0.5">{formatRange(post.starts_at, post.ends_at)}</span></button></li>)}</ul>}
    </div>
  </section>;
}
