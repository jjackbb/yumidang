import React, { useState } from 'react';
import { X, Send, Calendar, MapPin, AlertCircle, ShieldCheck, Sparkles, User } from 'lucide-react';
import { MeetupPost, Appointment, CurrentUser } from '../types';
import { overlappingAppointments } from '../utils/postLifecycle';
import { publicProfileForPost } from '../data/publicProfiles';

interface JoinRequestModalProps {
  post: MeetupPost | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  appointments: Appointment[];
  onSubmitRequest: (postId: string, message: string) => boolean;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  post,
  isOpen,
  onClose,
  currentUser,
  appointments,
  onSubmitRequest,
}) => {
  const [message, setMessage] = useState(
    '안녕하세요! 공고 내용 확인하고 취향이 잘 맞을 것 같아 신청드립니다. 약속 시간 철저히 지키겠습니다 :)'
  );

  if (!isOpen || !post) return null;

  const conflicts = overlappingAppointments(appointments, currentUser ? [currentUser.id] : [], post.startsAt, post.endsAt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (onSubmitRequest(post.id, message.trim())) onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="동행 참여 신청" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6c2cf5] text-white flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[17px] font-bold text-gray-900">1:1 동행 참여 신청</h3>
          </div>
          <button
            onClick={onClose} aria-label="신청 창 닫기"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Meetup Summary */}
          <div className="p-3.5 bg-[#f8f9fc] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-0.5 rounded-full">
                {post.category}
              </span>
              <span className="text-xs font-semibold text-gray-500">
                작성자: {post.author} · 당도 {publicProfileForPost(post, currentUser).sugarContent ?? '정보 없음'}
              </span>
            </div>
            <h4 className="font-bold text-sm text-gray-900 leading-snug">
              {post.title}
            </h4>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {post.time}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {post.location}
              </span>
            </div>
          </div>

          {/* Schedule Conflict Warning (Phase 3 Requirement) */}
          {conflicts.length > 0 && (
            <div className="p-3.5 bg-amber-50 rounded-2xl flex items-start gap-2 text-xs text-amber-900 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">⚠️ 일정 중복 주의 안내</span>
                <span>
                  {conflicts.map(item => `${item.title} (${item.dateTime})`).join(' · ')}와 시간이 겹쳐요. 신청 전에 계속 진행할지 확인합니다.
                </span>
              </div>
            </div>
          )}

          {/* Sender Profile Preview */}
          {currentUser && (
            <div className="p-3.5 bg-gray-50 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.maskedName}
                  className="w-8 h-8 rounded-full object-cover shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900">{currentUser.maskedName}</span>
                    <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-1.5 py-0.5 rounded">
                      나의 프로필
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500">당도 {Math.round(currentUser.sugarContent)} 🍯</span>
                </div>
              </div>
              <span className="text-[11px] text-gray-400">호스트에게 전달됨</span>
            </div>
          )}

          {/* Introduction Message Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              호스트에게 전할 소개 메시지
            </label>
            <textarea
              rows={4}
              required
              placeholder="동행에 지원하게 된 이유, 본인 소개 등을 친절하게 적어주시면 매칭 확률이 높아집니다."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5] resize-none leading-relaxed text-gray-900"
            />
          </div>

          {/* 1:1 Matching Commitment Notice */}
          <div className="p-3.5 bg-[#f0edff] rounded-2xl text-[11px] text-[#6c2cf5] leading-relaxed">
            <span className="font-bold block mb-0.5">🤝 1:1 동행 매칭 약속</span>
            신청하면 바로 작성자와 대화할 수 있어요. 작성자가 [수락]하면 동행이 확정되고, 같은 채팅방에서 약속을 이어갑니다. 확정 전에는 신청을 취소할 수 있어요.
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>1:1 동행 신청서 전달하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
