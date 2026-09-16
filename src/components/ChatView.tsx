import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Send,
  Phone,
  CalendarClock,
  X,
} from 'lucide-react';
import type {
  Appointment,
  ChatRoom,
  CurrentUser,
  JoinRequest,
  MeetupPost,
  PublicUserProfile,
  ScheduleProposal,
} from '../types';
import { CompletionActions, CompletionActionsProps } from './CompletionActions';
import {
  formatClock,
  formatMeetupRange,
  isValidMeetupRange,
} from '../utils/meetupLifecycle';
import { koreaDateKey } from '../utils/calendar';
import { ConditionReview } from './ConditionReview';
import { isConfirmedAppointment, isOpenRequest } from '../utils/postLifecycle';
import { DEMO_USER_ID } from '../data/demoIdentity';

interface ChatViewProps {
  room: ChatRoom;
  user: CurrentUser;
  partner: PublicUserProfile;
  post?: MeetupPost;
  request?: JoinRequest;
  appointment?: Appointment;
  status: { canSend: boolean; label: string };
  completionActions?: CompletionActionsProps;
  onBack: () => void;
  onOpenPost: () => void;
  onOpenProfile: () => void;
  onOpenDashboard: () => void;
  onOpenVoiceCall: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onCancelAppointment: () => void;
  onReconfirm: (revision: number, agree: boolean, simulate?: boolean) => void;
  onSimulatePostChange: () => void;
  onSimulateAccept: () => void;
  onSend: (text: string, sample?: boolean) => void;
  onDraft: (text: string) => void;
  onPropose: (proposal: ScheduleProposal) => void;
  onResolveProposal: (id: string, accepted: boolean, sample?: boolean) => void;
}

export function ChatView({
  room,
  user,
  partner,
  post,
  request,
  appointment,
  status,
  completionActions,
  onBack,
  onOpenPost,
  onOpenProfile,
  onOpenDashboard,
  onOpenVoiceCall,
  onAccept,
  onReject,
  onCancel,
  onCancelAppointment,
  onReconfirm,
  onSimulatePostChange,
  onSimulateAccept,
  onSend,
  onDraft,
  onPropose,
  onResolveProposal,
}: ChatViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [room.messages.length]);
  useEffect(() => {
    if (request?.status === 'reconfirming' && messageListRef.current)
      messageListRef.current.scrollTop = 0;
  }, [request?.reconfirmation?.revision, request?.status]);
  const pending = request && isOpenRequest(request) && status.canSend;
  const local = (iso?: string) =>
    iso && Number.isFinite(Date.parse(iso))
      ? `${koreaDateKey(new Date(iso))}T${formatClock(iso)}`
      : '';
  const openProposal = () => {
    setStartsAt(local(appointment?.scheduledAt));
    setEndsAt(local(appointment?.endsAt));
    setLocation(appointment?.location || '');
    setError('');
    setProposalOpen(true);
  };
  const submitProposal = (event: React.FormEvent) => {
    event.preventDefault();
    const start = `${startsAt}:00+09:00`,
      end = `${endsAt}:00+09:00`;
    if (!isValidMeetupRange(start, end)) {
      setError('종료 시각은 시작 시각보다 늦어야 해요.');
      return;
    }
    onPropose({
      id: crypto.randomUUID(),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      newDateTime: formatMeetupRange(start, end),
      newLocation: location.trim(),
      status: 'pending',
      proposerName: user.maskedName,
    });
    setProposalOpen(false);
  };
  return (
    <section
      aria-label="동행 대화방"
      data-active-room={room.id}
      className="flex flex-col h-[calc(100dvh-126px-var(--demo-bar-h,0px)-var(--service-banner-h,0px))] min-h-0 text-left bg-[#f7f6fa]"
    >
      <header className="bg-white px-3 py-3 flex items-center gap-2 border-b border-gray-100 shrink-0">
        <button onClick={onBack} aria-label="채팅 목록으로" className="p-2">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={onOpenProfile}
          aria-label={`${partner.displayName}님의 상세 프로필 보기`}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <img
            src={partner.avatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <span className="min-w-0">
            <b className="block text-sm">{partner.displayName}</b>
            <span className="block text-[11px] text-gray-500">
              {partner.sugarContent === null
                ? '프로필 보기'
                : `당도 ${partner.sugarContent} · 프로필 보기`}
            </span>
          </span>
        </button>
        {appointment && isConfirmedAppointment(appointment) && (
          <button
            onClick={onOpenVoiceCall}
            aria-label="안심 통화 안내"
            className="text-[#6c2cf5] flex flex-col items-center p-2"
          >
            <Phone size={17} />
            <span className="text-[9px] mt-1">준비 중</span>
          </button>
        )}
      </header>
      <div className="bg-white px-4 pb-3 pt-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold text-[#6c2cf5]"
            data-chat-status
          >
            {status.label}
          </span>
          {appointment && (
            <button
              onClick={onOpenDashboard}
              className="text-[11px] text-[#6c2cf5] font-bold"
            >
              약속 상세 →
            </button>
          )}
        </div>
        <button
          onClick={onOpenPost}
          disabled={!post}
          className="flex items-center justify-between w-full text-left gap-2 mt-2 disabled:text-gray-400"
        >
          <b className="text-xs line-clamp-2">
            {post?.title || room.postTitle}
          </b>
          <ChevronRight size={15} className="shrink-0 text-gray-400" />
        </button>
        <p className="text-[10px] text-gray-500 mt-1">
          {appointment?.dateTime || post?.time || '삭제된 공고입니다.'}
        </p>
        {pending && (
          <div className="flex gap-2 mt-3">
            {request.hostId === user.id ? (
              <>
                <button
                  onClick={onReject}
                  className="flex-1 text-xs py-2 rounded-lg bg-gray-100 text-gray-600"
                >
                  거절
                </button>
                <button
                  disabled={request.status === 'reconfirming'}
                  onClick={onAccept}
                  className="flex-1 text-xs py-2 rounded-lg bg-[#6c2cf5] text-white font-bold disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {request.status === 'reconfirming'
                    ? '조건 동의 대기'
                    : '동행 수락하기'}
                </button>
              </>
            ) : (
              <p className="text-[11px] text-gray-500">
                작성자가 수락하면 동행이 확정돼요.{' '}
                <button onClick={onCancel} className="underline">
                  신청 취소
                </button>
              </p>
            )}
          </div>
        )}
      </div>
      {appointment && isConfirmedAppointment(appointment) && (
        <button
          onClick={onCancelAppointment}
          className="text-[11px] text-gray-500 underline px-4 py-2 bg-white text-right"
        >
          확정 동행 취소
        </button>
      )}
      <div
        ref={messageListRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
      >
        {request && (
          <ConditionReview
            request={request}
            userId={user.id}
            onRespond={(revision, agree) => onReconfirm(revision, agree)}
            onSimulate={
              user.id === DEMO_USER_ID && request.hostId === user.id
                ? (revision, agree) => onReconfirm(revision, agree, true)
                : undefined
            }
          />
        )}
        {appointment?.cancellation && (
          <p className="bg-gray-100 rounded-xl p-3 text-xs text-gray-600">
            취소 사유: {appointment.cancellation.reason}
          </p>
        )}
        {room.messages.map((message) =>
          message.senderId === 'system' ? (
            <p
              key={message.id}
              className="text-center text-[10px] leading-relaxed text-gray-500 bg-gray-100 rounded-xl px-3 py-2"
            >
              {message.text}
            </p>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed ${message.senderId === user.id ? 'bg-[#6c2cf5] text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'}`}
              >
                {message.isSample && (
                  <span className="block text-[9px] opacity-70 mb-1">
                    상대방 응답 시연
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words">
                  {message.text}
                </p>
                {message.proposal && (
                  <div className="bg-white text-gray-700 rounded-xl mt-2 p-3 space-y-2">
                    <b className="block text-[11px]">일정·장소 변경 제안</b>
                    <p>{message.proposal.newDateTime}</p>
                    <p>{message.proposal.newLocation}</p>
                    <p className="text-[10px] text-[#6c2cf5]">
                      {message.proposal.status === 'cancelled'
                        ? '동행 취소로 변경 제안 종료'
                        : message.proposal.status === 'accepted'
                          ? '변경 수락됨'
                          : message.proposal.status === 'rejected'
                            ? '변경 거절됨 · 기존 일정 유지'
                            : '상대 동의 전까지 기존 일정 유지'}
                    </p>
                    {message.proposal.status === 'pending' &&
                      status.canSend &&
                      (message.senderId !== user.id ||
                        user.id === DEMO_USER_ID) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              onResolveProposal(
                                message.id,
                                false,
                                message.senderId === user.id,
                              )
                            }
                            className="rounded-lg bg-gray-100 py-2 px-2 text-[10px]"
                          >
                            {message.senderId === user.id
                              ? '상대 거절 시연'
                              : '거절'}
                          </button>
                          <button
                            onClick={() =>
                              onResolveProposal(
                                message.id,
                                true,
                                message.senderId === user.id,
                              )
                            }
                            className="rounded-lg bg-purple-50 text-[#6c2cf5] py-2 px-2 text-[10px]"
                          >
                            {message.senderId === user.id
                              ? '상대 수락 시연'
                              : '수락'}
                          </button>
                        </div>
                      )}
                  </div>
                )}
                <span className="block mt-1 text-[9px] opacity-65">
                  {formatClock(message.createdAt)}
                </span>
              </div>
            </div>
          ),
        )}
        {appointment && completionActions && (
          <CompletionActions {...completionActions} />
        )}
        {user.id === DEMO_USER_ID && status.canSend && (
          <details className="text-[10px] text-gray-500 rounded-xl border border-dashed border-purple-200 p-3">
            <summary className="cursor-pointer">프로토타입 시연 도구</summary>
            <p className="mt-2">
              실제 상대방에게 전송되지 않습니다. 새로고침하면 초기화돼요.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {pending && request.requesterId === user.id && (
                <button
                  onClick={onSimulatePostChange}
                  className="rounded-lg bg-purple-50 text-[#6c2cf5] p-2"
                >
                  작성자 조건 변경 시연
                </button>
              )}
              <button
                onClick={() =>
                  onSend(
                    `공고의 일정과 활동 내용을 확인했어요. ${post?.category || '이번 동행'}에 대해 궁금한 점을 이야기해요.`,
                    true,
                  )
                }
                className="rounded-lg bg-purple-50 text-[#6c2cf5] p-2"
              >
                상대 답장 시연
              </button>
              {pending && request.requesterId === user.id && (
                <button
                  disabled={request.status === 'reconfirming'}
                  onClick={onSimulateAccept}
                  className="rounded-lg bg-purple-50 text-[#6c2cf5] p-2"
                >
                  작성자 수락 시연
                </button>
              )}
            </div>
          </details>
        )}
        <div ref={endRef} />
      </div>
      {!status.canSend ? (
        <p className="p-4 bg-gray-100 text-center text-xs text-gray-500">
          {status.label} · 이전 대화는 볼 수 있지만 새 메시지는 보낼 수 없어요.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (room.draft.trim()) onSend(room.draft.trim());
          }}
          className="bg-white p-3 flex gap-2 items-end border-t border-gray-100 shrink-0"
        >
          {appointment && isConfirmedAppointment(appointment) && (
            <button
              type="button"
              title="일정/장소 제안하기"
              onClick={openProposal}
              className="p-2 text-gray-500"
            >
              <CalendarClock size={19} />
            </button>
          )}
          <textarea
            aria-label="메시지"
            rows={1}
            value={room.draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (room.draft.trim()) onSend(room.draft.trim());
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 min-w-0 bg-gray-100 rounded-xl px-3 py-2 text-sm resize-none max-h-24 outline-none focus:ring-2 focus:ring-purple-200"
          />
          <button
            aria-label="메시지 보내기"
            disabled={!room.draft.trim()}
            type="submit"
            className="p-2.5 bg-[#6c2cf5] rounded-xl text-white disabled:bg-gray-200"
          >
            <Send size={17} />
          </button>
        </form>
      )}
      {proposalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="일정 장소 변경 제안"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={submitProposal}
            className="bg-white rounded-3xl p-5 max-w-[400px] w-full space-y-4"
          >
            <div className="flex justify-between">
              <h2 className="font-bold text-sm">일정·장소 변경 제안</h2>
              <button
                type="button"
                aria-label="변경 제안 닫기"
                onClick={() => setProposalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <label className="block text-xs">
              새 시작 날짜·시각
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="block w-full bg-gray-50 p-3 rounded-xl mt-1"
              />
            </label>
            <label className="block text-xs">
              새 종료 날짜·시각
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="block w-full bg-gray-50 p-3 rounded-xl mt-1"
              />
            </label>
            <label className="block text-xs">
              새 만남 장소
              <input
                required
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="block w-full bg-gray-50 p-3 rounded-xl mt-1"
              />
            </label>
            {error && (
              <p role="alert" className="text-red-600 text-xs">
                {error}
              </p>
            )}
            <p className="text-[11px] text-gray-500">
              상대가 수락할 때까지 기존 약속이 유지됩니다.
            </p>
            <button
              type="submit"
              className="w-full bg-[#6c2cf5] text-white rounded-xl py-3 text-xs font-bold"
            >
              제안 전송하기
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
