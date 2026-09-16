import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, MapPin, UserRound } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { liveApi, type Post, type PublicProfile, type RequestStatus } from './api';
import { ageLabel, formatDateTime, formatRange, postStatusLabel, REQUEST_STATUS_LABEL } from './format';
import { Avatar, ErrorBox, Notice, PrimaryButton, Sheet, Skeleton, StatusChip } from './ui';

export function AuthorProfileSheet({ postId, onClose, backLabel = '공고로 돌아가기' }: { postId: string; onClose: () => void; backLabel?: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'unavailable' | 'error'; profile?: PublicProfile; error?: string }>({ status: 'loading' });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setState({ status: 'loading' });
    try {
      const profile = await liveApi.authorProfile(postId);
      if (current === sequence.current) setState(profile ? { status: 'ready', profile } : { status: 'unavailable' });
    } catch (err: any) {
      if (current === sequence.current) setState(err.code === 'profile_unavailable' ? { status: 'unavailable' } : { status: 'error', error: err.message });
    }
  }, [postId]);
  useEffect(() => { void load(); }, [load]);
  return <Sheet label="작성자 프로필" onClose={onClose} z="z-50">
    {state.status === 'loading' && <Skeleton rows={2} />}
    {state.status === 'error' && <ErrorBox message={state.error!} onRetry={() => void load()} />}
    {state.status === 'unavailable' && <p className="text-sm text-gray-600">프로필을 볼 수 없어요.</p>}
    {state.status === 'ready' && state.profile && <ProfileCard profile={state.profile} />}
    <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold">{backLabel}</button>
  </Sheet>;
}

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  return <div data-testid="public-profile" className="flex gap-3 items-start">
    <Avatar url={profile.avatar_url} label={profile.masked_name} size="w-16 h-16" />
    <div className="space-y-1">
      <p className="font-bold text-lg"><span data-testid="masked-name">{profile.masked_name}</span> · <span data-testid="public-age">{ageLabel(profile.age)}</span></p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio || '아직 자기소개를 작성하지 않았어요.'}</p>
      <p className="text-[11px] text-gray-400">실명은 가려서 보여주며, 신분증 확인이나 실명 인증 표시는 아니에요.</p>
    </div>
  </div>;
}

interface MyRequest { id: string; status: RequestStatus }

export function PostDetail({ postId, userId, onClose, onLoginRequired, onOpenChat, onChanged }: {
  postId: string; userId: string | null; onClose: () => void; onLoginRequired: () => void;
  onOpenChat: (requestId: string) => void; onChanged: () => void;
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [windowInfo, setWindowInfo] = useState<{ accepting_requests: boolean; server_now: string } | null>(null);
  const [exactLocation, setExactLocation] = useState<string | null>(null);
  const [myRequest, setMyRequest] = useState<MyRequest | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [row, info] = await Promise.all([liveApi.getPost(postId), liveApi.requestWindow(postId)]);
      if (!row) { setStatus('missing'); return; }
      setPost(row); setWindowInfo(info);
      if (userId) {
        // RLS returns the exact place only to the author or the confirmed companion.
        const [location, requests] = await Promise.all([
          liveApi.exactLocation(postId),
          getSupabaseClient().from('join_requests').select('id,status').eq('post_id', postId).eq('requester_id', userId),
        ]);
        setExactLocation(location);
        setMyRequest((requests.data?.[0] as MyRequest | undefined) || null);
      }
      setStatus('ready');
    } catch (err: any) { setError(err.message); setStatus('error'); }
  }, [postId, userId]);
  useEffect(() => { void load(); }, [load]);

  const isAuthor = Boolean(post && userId && post.author_id === userId);
  const accepting = Boolean(windowInfo?.accepting_requests);

  const submit = async () => {
    if (!post) return;
    const trimmed = message.trim();
    if (trimmed.length < 10 || trimmed.length > 300) { setSendError('소개 메시지는 공백을 제외하고 10~300자로 입력해 주세요.'); return; }
    setSending(true); setSendError('');
    try {
      const created = await liveApi.createJoinRequest(post.id, trimmed);
      setMyRequest({ id: created.id, status: created.status });
      setComposing(false); setMessage('');
      onChanged();
    } catch (err: any) { setSendError(err.message); } finally { setSending(false); }
  };

  return <Sheet label="공고 상세" onClose={onClose}>
    {status === 'loading' && <Skeleton rows={3} />}
    {status === 'error' && <ErrorBox message={error} onRetry={() => void load()} />}
    {status === 'missing' && <p className="text-sm text-gray-600">삭제됐거나 존재하지 않는 공고예요.</p>}
    {status === 'ready' && post && windowInfo && <>
      <div className="space-y-1.5">
        <div className="flex gap-1.5"><StatusChip>{post.category}</StatusChip><StatusChip tone={accepting ? 'green' : 'gray'}>{postStatusLabel(post, windowInfo.server_now)}</StatusChip><StatusChip tone="gray">정원 2명</StatusChip></div>
        <h2 className="text-lg font-bold">{post.title}</h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.description}</p>
      </div>
      <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-sm">
        <dt className="text-gray-500">일정</dt><dd>{formatRange(post.starts_at, post.ends_at)}</dd>
        <dt className="text-gray-500">모집 마감</dt><dd>{formatDateTime(post.recruitment_ends_at)}</dd>
        <dt className="text-gray-500">공개 위치</dt><dd data-testid="public-area" className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{post.public_area}</dd>
        {post.preference_note && <><dt className="text-gray-500">선호 조건</dt><dd>{post.preference_note}</dd></>}
        {post.tags.length > 0 && <><dt className="text-gray-500">태그</dt><dd>#{post.tags.join(' #')}</dd></>}
      </dl>
      {exactLocation
        ? <div data-testid="exact-location" className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm"><p className="text-[11px] font-bold text-emerald-700 mb-0.5">{isAuthor ? '정확한 만남 장소 (작성자와 확정된 동행자만 볼 수 있어요)' : '확정된 동행의 정확한 만남 장소'}</p>{exactLocation}</div>
        : <p data-testid="exact-location-hidden" className="text-xs text-gray-500 flex items-center gap-1"><Lock className="w-3.5 h-3.5" />정확한 만남 장소는 동행이 확정된 두 사람에게만 공개돼요.</p>}

      {!isAuthor && <button type="button" onClick={() => userId ? setShowProfile(true) : onLoginRequired()} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold flex items-center justify-center gap-1.5"><UserRound className="w-4 h-4" />작성자 프로필 보기</button>}

      {isAuthor && <Notice>내가 작성한 공고예요. 받은 요청은 Me와 채팅에서 확인해요.</Notice>}
      {!isAuthor && myRequest && <div className="space-y-2">
        <Notice>이미 신청한 공고예요 · <strong data-testid="my-request-status">{REQUEST_STATUS_LABEL[myRequest.status]}</strong></Notice>
        <PrimaryButton onClick={() => onOpenChat(myRequest.id)}>신청 대화 열기</PrimaryButton>
      </div>}
      {!isAuthor && !myRequest && !accepting && <Notice>모집이 마감되어 새 참여 요청을 보낼 수 없어요.</Notice>}
      {!isAuthor && !myRequest && accepting && !composing && <PrimaryButton onClick={() => userId ? setComposing(true) : onLoginRequired()}>참여 요청하기</PrimaryButton>}
      {!isAuthor && !myRequest && accepting && composing && <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-2">
        <label htmlFor="join-message" className="block text-xs font-bold">작성자에게 보낼 소개 메시지 (10~300자)</label>
        <textarea id="join-message" value={message} maxLength={300} onChange={event => { setMessage(event.target.value); setSendError(''); }} rows={4} className="w-full rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm" />
        <p className="text-[11px] text-gray-400">{message.trim().length}/300 · 요청하면 작성자와 매칭 대화를 시작할 수 있어요.</p>
        {sendError && <ErrorBox message={sendError} />}
        <PrimaryButton type="submit" disabled={sending}>{sending ? '보내는 중…' : '참여 요청 보내기'}</PrimaryButton>
      </form>}
      {showProfile && <AuthorProfileSheet postId={post.id} onClose={() => setShowProfile(false)} />}
    </>}
  </Sheet>;
}
