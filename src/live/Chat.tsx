import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { liveApi, type ChatMessage, type Conversation, type ConversationSummary } from './api';
import { AppointmentPanel } from './Appointment';
import { ageLabel, formatDateTime, formatRange, mergeMessages, REQUEST_STATUS_LABEL } from './format';
import { useRealtime } from './realtime';
import { Avatar, ErrorBox, Notice, PrimaryButton, Sheet, Skeleton, StatusChip } from './ui';
import { ProfileCard } from './PostDetail';

export function ConversationList({ onOpen }: { onOpen: (requestId: string) => void }) {
  const [rows, setRows] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setRows(await liveApi.conversations()); setError(''); } catch (err: any) { setError(err.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Any request/message change visible to me (RLS-filtered) refreshes the list.
  useRealtime('conversations', [
    { table: 'join_requests', event: '*', onChange: () => void load() },
    { table: 'chat_messages', event: 'INSERT', onChange: () => void load() },
  ]);
  return <section aria-label="매칭 대화 목록" className="p-4 space-y-2 pb-28">
    <h2 className="text-lg font-bold">채팅</h2>
    {error && <ErrorBox message={error} onRetry={() => void load()} />}
    {!rows && !error && <Skeleton />}
    {rows?.length === 0 && <p className="text-sm text-gray-500 py-8 text-center">아직 매칭 대화가 없어요. 공고에 참여 요청을 보내 보세요.</p>}
    <ul className="space-y-2">{rows?.map(row => <li key={row.request_id}>
      <button type="button" onClick={() => onOpen(row.request_id)} className="w-full text-left flex gap-3 rounded-2xl border border-gray-100 p-3">
        <Avatar url={row.counterpart_avatar_url} label={row.counterpart_masked_name} size="w-10 h-10" />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5"><strong className="text-sm">{row.counterpart_masked_name}</strong><StatusChip tone={row.request_status === 'matched' ? 'green' : row.request_status === 'pending' ? 'purple' : 'gray'}>{REQUEST_STATUS_LABEL[row.request_status]}</StatusChip></span>
          <span className="block text-xs text-gray-500 truncate">{row.post_title}</span>
          <span className="block text-xs text-gray-700 truncate">{row.last_message || '아직 메시지가 없어요.'}</span>
        </span>
      </button>
    </li>)}</ul>
  </section>;
}

type Outgoing = { id: string; content: string; state: 'sending' | 'failed'; error?: string };

export function ChatRoom({ requestId, userId, onBack }: { requestId: string; userId: string; onBack: () => void }) {
  const [header, setHeader] = useState<Conversation | null>(null);
  const [headerError, setHeaderError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [actionError, setActionError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadHeader = useCallback(async () => {
    try { setHeader(await liveApi.conversation(requestId)); setHeaderError(''); } catch (err: any) { setHeaderError(err.message); }
  }, [requestId]);
  const loadLatest = useCallback(async () => {
    try {
      const page = await liveApi.messages(requestId);
      setMessages(previous => mergeMessages(previous, page));
      setHasOlder(page.length === 50);
      setLoaded(true);
    } catch (err: any) { setHeaderError(err.message); }
  }, [requestId]);
  useEffect(() => { void loadHeader(); void loadLatest(); }, [loadHeader, loadLatest]);
  const live = useRealtime(`chat:${requestId}`, [
    { table: 'chat_messages', event: 'INSERT', filter: `join_request_id=eq.${requestId}`, onChange: row => setMessages(previous => mergeMessages(previous, [row])) },
    { table: 'join_requests', event: 'UPDATE', filter: `id=eq.${requestId}`, onChange: () => void loadHeader() },
    { table: 'appointments', event: 'INSERT', filter: `join_request_id=eq.${requestId}`, onChange: () => void loadHeader() },
  ], () => { void loadLatest(); void loadHeader(); });
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, outgoing.length]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const page = await liveApi.messages(requestId, oldest);
    setMessages(previous => mergeMessages(previous, page));
    setHasOlder(page.length === 50);
  };

  // Each message has its own in-flight state; no global lock blocks other sends.
  const deliver = async (item: Outgoing) => {
    setOutgoing(previous => previous.map(entry => entry.id === item.id ? { ...entry, state: 'sending', error: undefined } : entry));
    try {
      const saved = await liveApi.sendMessage({ id: item.id, join_request_id: requestId, sender_id: userId, content: item.content });
      setMessages(previous => mergeMessages(previous, [saved]));
      setOutgoing(previous => previous.filter(entry => entry.id !== item.id));
    } catch (err: any) {
      setOutgoing(previous => previous.map(entry => entry.id === item.id ? { ...entry, state: 'failed', error: err.message } : entry));
      void loadHeader();
    }
  };
  const send = () => {
    const content = draft.trim();
    if (!content) return;
    if (content.length > 1000) { setActionError('메시지는 1,000자 이하로 입력해 주세요.'); return; }
    const item: Outgoing = { id: crypto.randomUUID(), content, state: 'sending' };
    setOutgoing(previous => [...previous, item]);
    setDraft(''); setActionError('');
    void deliver(item);
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError('');
    try { await fn(); await loadHeader(); } catch (err: any) { setActionError(err.message); await loadHeader(); }
  };

  if (headerError && !header) return <section className="p-4 space-y-3"><button type="button" onClick={onBack} className="text-sm font-bold flex items-center gap-1"><ArrowLeft className="w-4 h-4" />목록</button><ErrorBox message={headerError} onRetry={() => void loadHeader()} /></section>;
  if (!header) return <section className="p-4"><Skeleton rows={4} /></section>;

  const visible = messages.filter(message => !outgoing.some(item => item.id === message.id));
  const canMatch = header.my_role === 'author' && header.request_status === 'pending' && header.post_status === 'recruiting' && Date.parse(header.server_now) < Date.parse(header.post_starts_at);

  return <section aria-label="매칭 대화" data-realtime={live ? 'ready' : 'connecting'} className="flex flex-col flex-1 min-h-0 pb-20">
    <header className="sticky top-[61px] z-20 bg-white border-b border-gray-100 px-3 py-2.5 flex items-center gap-2">
      <button type="button" aria-label="대화 목록으로" onClick={onBack} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
      <button type="button" onClick={() => setProfileOpen(true)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <Avatar url={header.counterpart_avatar_url} label={header.counterpart_masked_name} size="w-9 h-9" />
        <span className="min-w-0"><strong data-testid="chat-counterpart" className="text-sm">{header.counterpart_masked_name}</strong><span className="block text-[11px] text-gray-500 truncate">{header.post_title}</span></span>
      </button>
      <StatusChip tone={header.request_status === 'matched' ? 'green' : header.request_status === 'pending' ? 'purple' : 'gray'}><span data-testid="request-status">{REQUEST_STATUS_LABEL[header.request_status]}</span></StatusChip>
    </header>

    <div className="px-3 pt-3 space-y-2">
      <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-1">
        <p className="text-gray-500">{formatRange(header.post_starts_at, header.post_ends_at)} · {header.post_public_area}</p>
        <p className="font-bold">참여 요청 소개</p><p className="text-gray-700 whitespace-pre-wrap">{header.request_message}</p>
      </div>
      {header.request_status === 'not_selected' && <Notice>다른 동행자와 확정되었어요. 이전 대화만 볼 수 있어요.</Notice>}
      {header.request_status === 'pending' && <p className="text-[11px] text-gray-500">최종 확정 전에는 상세 주소와 연락처 공유를 피해주세요.</p>}
      {actionError && <ErrorBox message={actionError} />}
      {header.request_status === 'pending' && <div className="flex gap-2">
        {canMatch && <button type="button" onClick={() => setConfirmOpen(true)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">이 신청자와 동행 확정</button>}
        {header.my_role === 'author' && <button type="button" onClick={() => void runAction(() => liveApi.declineJoinRequest(requestId))} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold">신청 거절</button>}
        {header.my_role === 'requester' && <button type="button" onClick={() => void runAction(() => liveApi.withdrawJoinRequest(requestId))} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold">신청 취소</button>}
      </div>}
    </div>

    {header.appointment_id && <AppointmentPanel appointmentId={header.appointment_id} />}

    <div aria-label="메시지 목록" role="log" className="flex-1 px-3 py-2 space-y-1.5">
      {hasOlder && <button type="button" onClick={() => void loadOlder()} className="w-full text-xs text-gray-500 py-1">이전 메시지 더 보기</button>}
      {!loaded && <Skeleton rows={2} />}
      {visible.map(message => <div key={message.id} data-message-id={message.id} className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
        <p className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${message.sender_id === userId ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100'}`}>{message.content}
          <span className={`block text-[10px] mt-0.5 ${message.sender_id === userId ? 'text-purple-100' : 'text-gray-400'}`}>{formatDateTime(message.created_at)}</span></p>
      </div>)}
      {outgoing.map(item => <div key={item.id} data-outgoing={item.state} className="flex justify-end">
        <div className="max-w-[75%] text-right"><p className="rounded-2xl px-3 py-2 text-sm bg-purple-300 text-white whitespace-pre-wrap">{item.content}</p>
          {item.state === 'sending' ? <span className="text-[10px] text-gray-400">전송 중…</span>
            : <span className="text-[10px] text-rose-600">{item.error} <button type="button" onClick={() => void deliver(item)} className="font-bold underline">다시 보내기</button></span>}</div>
      </div>)}
      <div ref={bottom} />
    </div>

    {header.can_send
      ? <form onSubmit={event => { event.preventDefault(); send(); }} className="fixed bottom-[64px] left-0 right-0 max-w-[440px] mx-auto bg-white border-t border-gray-100 p-2 flex gap-2 z-20">
        <label className="sr-only" htmlFor="chat-input">메시지 입력</label>
        <input id="chat-input" value={draft} maxLength={1000} onChange={event => setDraft(event.target.value)} placeholder="메시지를 입력하세요" className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm" />
        <button type="submit" aria-label="메시지 보내기" className="px-3 rounded-xl bg-[#6c2cf5] text-white"><Send className="w-4 h-4" /></button>
      </form>
      : <p data-testid="chat-read-only" className="fixed bottom-[64px] left-0 right-0 max-w-[440px] mx-auto bg-gray-50 border-t border-gray-100 p-3 text-xs text-gray-500 text-center z-20">이 대화는 읽기 전용이에요. 새 메시지를 보낼 수 없어요.</p>}

    {confirmOpen && <ConfirmMatchSheet header={header} onClose={() => setConfirmOpen(false)} onConfirm={async () => {
      await liveApi.confirmMatch(requestId);
      setConfirmOpen(false);
      await loadHeader();
    }} />}
    {profileOpen && <CounterpartProfileSheet requestId={requestId} onClose={() => setProfileOpen(false)} />}
  </section>;
}

function CounterpartProfileSheet({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof liveApi.counterpartProfile>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { liveApi.counterpartProfile(requestId).then(setProfile, err => setError(err.message)); }, [requestId]);
  return <Sheet label="상대 프로필" onClose={onClose} z="z-50">
    {error ? <ErrorBox message={error} /> : profile ? <ProfileCard profile={profile} /> : <Skeleton rows={1} />}
    <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold">대화로 돌아가기</button>
  </Sheet>;
}

function ConfirmMatchSheet({ header, onClose, onConfirm }: { header: Conversation; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [exactLocation, setExactLocation] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof liveApi.counterpartProfile>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    liveApi.exactLocation(header.post_id).then(setExactLocation, err => setError(err.message));
    liveApi.counterpartProfile(header.request_id).then(setProfile, () => {});
  }, [header.post_id, header.request_id]);
  return <Sheet label="동행 확정" onClose={onClose} z="z-50">
    <p className="text-sm"><strong>{header.counterpart_masked_name}</strong>{profile ? ` · ${ageLabel(profile.age)}` : ''}님과 동행을 확정할까요?</p>
    <p className="text-xs text-gray-600">{header.post_title} · {formatRange(header.post_starts_at, header.post_ends_at)} · {header.post_public_area}</p>
    <div className="rounded-xl bg-emerald-50 p-3 text-sm"><p className="text-[11px] font-bold text-emerald-700">공고 작성 때 저장한 정확한 만남 장소</p>{exactLocation === undefined ? '불러오는 중…' : exactLocation || '저장된 장소가 없어요.'}</div>
    <Notice>확정하면 다른 신청은 종료됩니다. 확정된 상대에게만 정확한 장소가 공개돼요.</Notice>
    {error && <ErrorBox message={error} />}
    <PrimaryButton disabled={busy || !exactLocation} onClick={async () => {
      setBusy(true); setError('');
      try { await onConfirm(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
    }}>{busy ? '확정 중…' : '최종 동행 확정'}</PrimaryButton>
  </Sheet>;
}
