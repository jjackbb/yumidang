import React from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import type { JoinRequest } from '../types';
import { ConditionReview } from './ConditionReview';
import { DEMO_USER_ID } from '../data/demoIdentity';
import { isOpenRequest } from '../utils/postLifecycle';
import { requestStatusLabel } from '../utils/conversations';

export type RequestTab = 'sent' | 'received';
export interface CompanionRequestsProps {
  userId: string;
  requests: JoinRequest[];
  tab: RequestTab;
  onChangeTab: (tab: RequestTab) => void;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onOpenPost: (postId: string) => void;
  onOpenChat: (id: string) => void;
  onOpenProfile: (id: string) => void;
  onCancel: (id: string) => void;
  onReconfirm: (
    id: string,
    revision: number,
    agree: boolean,
    simulate?: boolean,
  ) => void;
}
export function CompanionRequests({
  userId,
  requests,
  tab,
  onChangeTab,
  onAccept,
  onReject,
  onOpenPost,
  onOpenChat,
  onOpenProfile,
  onCancel,
  onReconfirm,
}: CompanionRequestsProps) {
  const sent = requests.filter((r) => r.requesterId === userId);
  const received = requests.filter((r) => r.hostId === userId);
  const visible = tab === 'sent' ? sent : received;
  const labels = requestStatusLabel;
  return (
    <section
      aria-label="나의 동행 신청"
      className="bg-white px-5 pt-5 pb-6 border-b border-gray-100"
    >
      <h1 className="text-xl font-bold mb-4">나의 동행</h1>
      <div
        role="tablist"
        aria-label="동행 신청 구분"
        className="flex border-b border-gray-100 mb-4"
      >
        {(
          [
            ['sent', '신청한 동행', sent.length],
            ['received', '받은 신청', received.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => onChangeTab(value)}
            className={`flex-1 pb-3 text-sm font-bold border-b-2 ${tab === value ? 'border-[#6c2cf5] text-[#6c2cf5]' : 'border-transparent text-gray-400'}`}
          >
            {label} <span className="ml-1">{count}</span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={tab === 'sent' ? '신청한 동행' : '받은 신청'}
        className="space-y-3"
      >
        {visible.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Inbox className="mx-auto mb-3" />
            <p className="text-sm">
              {tab === 'sent'
                ? '아직 신청한 동행이 없어요.'
                : '아직 받은 신청이 없어요.'}
            </p>
          </div>
        )}
        {visible.map((request) => (
          <article
            key={request.id}
            data-request-id={request.id}
            className="border border-gray-100 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[11px] px-2 py-1 rounded-full font-bold ${request.status === 'accepted' ? 'text-green-700 bg-green-50' : isOpenRequest(request) ? 'text-[#6c2cf5] bg-purple-50' : 'text-gray-500 bg-gray-100'}`}
              >
                {labels[request.status]}
              </span>
              <span className="text-[11px] text-gray-400">
                {request.createdAt}
              </span>
            </div>
            <button
              onClick={() => onOpenPost(request.postId)}
              className="flex w-full items-center justify-between gap-2 text-left font-bold text-sm leading-relaxed"
            >
              {request.postTitle}
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
            {tab === 'received' && (
              <button
                onClick={() => onOpenProfile(request.id)}
                aria-label={`${request.requesterName}님의 상세 프로필 보기`}
                className="flex items-center gap-2 mt-3 w-full text-left"
              >
                <img
                  src={request.requesterAvatar}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="text-xs font-semibold">
                  {request.requesterName}
                </span>
                <span className="text-xs text-amber-600">
                  당도 {request.requesterSugar}
                </span>
                <span className="ml-auto text-[11px] text-[#6c2cf5]">
                  프로필 보기 →
                </span>
              </button>
            )}
            <p className="text-xs leading-relaxed text-gray-500 mt-3">
              {request.message}
            </p>
            {request.cancellationReason && (
              <p className="text-xs text-gray-500 mt-2">
                취소 사유: {request.cancellationReason}
              </p>
            )}
            <ConditionReview
              request={request}
              userId={userId}
              onRespond={(revision, agree) =>
                onReconfirm(request.id, revision, agree)
              }
              onSimulate={
                userId === DEMO_USER_ID && request.hostId === userId
                  ? (revision, agree) =>
                      onReconfirm(request.id, revision, agree, true)
                  : undefined
              }
            />
            <button
              onClick={() => onOpenChat(request.id)}
              className="w-full mt-3 bg-purple-50 text-[#6c2cf5] py-2.5 rounded-xl text-xs font-bold"
            >
              {isOpenRequest(request) ? '대화하기' : '대화 내역 보기'}
            </button>
            {tab === 'sent' && isOpenRequest(request) && (
              <button
                onClick={() => onCancel(request.id)}
                className="text-xs text-gray-500 underline mt-3"
              >
                신청 취소
              </button>
            )}
            {tab === 'received' && isOpenRequest(request) && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onReject(request.id)}
                  className="flex-1 bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-semibold"
                >
                  거절
                </button>
                <button
                  disabled={request.status === 'reconfirming'}
                  onClick={() => onAccept(request.id)}
                  className="flex-1 bg-[#6c2cf5] text-white py-2.5 rounded-xl text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {request.status === 'reconfirming'
                    ? '조건 동의 대기'
                    : '수락하기'}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
