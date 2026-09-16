import React from 'react';
import { X, Clock, MapPin, Share2, Calendar, MessageCircle, Star, Navigation, ShieldCheck, ShieldAlert, BellRing } from 'lucide-react';
import { isConfirmedAppointment } from '../utils/postLifecycle';
import { Appointment, PublicUserProfile } from '../types';
import { CompletionActions, CompletionActionsProps } from './CompletionActions';

interface DashboardModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenSafetyRules?: () => void;
  onOpenReport?: () => void;
  onSendArrivalNotice?: () => void;
  completionActions: CompletionActionsProps;
  onCancelAppointment: () => void;
  partnerProfile?: PublicUserProfile;
  onOpenPartnerProfile?: () => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onOpenChat,
  onOpenSafetyRules,
  onOpenReport,
  onSendArrivalNotice,
  completionActions, onCancelAppointment, partnerProfile, onOpenPartnerProfile,
}) => {
  if (!isOpen || !appointment) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="약속 상세" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isConfirmedAppointment(appointment) ? 'bg-[#22c55e]' : 'bg-gray-400'}`} />
            <h3 className="text-[17px] font-bold text-gray-900">참여 대시보드</h3>
          </div>
          <button
            aria-label="참여 대시보드 닫기"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-left">
          {/* Status & D-day Banner */}
          <div className="bg-gradient-to-r from-[#6c2cf5]/10 to-[#8b5cf6]/10 rounded-[22px] p-4 flex items-center justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#6c2cf5] bg-white/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                {appointment.status}
              </span>
              <p className="text-[18px] font-extrabold text-gray-900 mt-1.5">
                {appointment.status === '동행 취소' ? '취소된 동행이에요' : appointment.status === '동행 완료' ? '동행을 완료했어요' : completionActions.availability.canComplete ? '동행 완료를 확인해 주세요' : '함께할 약속을 확인해 주세요'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-[#6c2cf5]">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {appointment.cancellation && <p className="rounded-xl bg-gray-100 p-3 text-xs text-gray-600">취소 사유: {appointment.cancellation.reason}</p>}
          {/* Appointment Title */}
          <div>
            <h4 className="text-[20px] font-bold text-gray-900 leading-snug">
              {appointment.title}
            </h4>
          </div>

          {/* Date and Location Card */}
          <div className="bg-[#f8f9fc] rounded-[22px] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white text-[#6c2cf5] shadow-xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">약속 일시</p>
                <p className="text-[15px] font-bold text-gray-900">{appointment.dateTime}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white text-[#6c2cf5] shadow-xs">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">약속 장소</p>
                <p className="text-[15px] font-bold text-gray-900">{appointment.location}</p>
                <p className="text-xs text-gray-500 mt-0.5">{appointment.addressDetail}</p>
              </div>
            </div>
          </div>

          {/* Partner Profile Card */}
          <div className="bg-white rounded-[22px] p-4 shadow-xs">
            <div className="text-xs font-semibold text-gray-500 mb-2.5">함께할 이웃</div>
            <button onClick={onOpenPartnerProfile} disabled={!partnerProfile} aria-label={`${partnerProfile?.displayName || appointment.partnerName}님의 상세 프로필 보기`} className="w-full text-left flex items-center gap-3.5">
              <img
                src={partnerProfile?.avatar || appointment.partnerAvatar}
                alt={appointment.partnerName}
                className="w-13 h-13 rounded-full object-cover shadow-2xs"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[16px] text-gray-900">{appointment.partnerName}</span>
                  <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-lg text-amber-600 text-xs font-bold">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>{partnerProfile?.sugarContent == null ? '당도 정보 없음' : `당도 ${partnerProfile.sugarContent} 🍯`}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {appointment.partnerBio}
                </p>
              </div>
            </button>

            {/* Menu recommendation */}
            <div className="mt-3.5 pt-3 flex items-center justify-between text-xs text-gray-600">
              <span className="text-gray-500">동행 활동:</span>
              <span className="font-semibold text-gray-800">{appointment.menuRecommendation}</span>
            </div>
          </div>

          {/* Safety & Arrival Notice Bar (Phase 4) */}
          <div className="space-y-2">
            <button
              disabled={!isConfirmedAppointment(appointment)}
              onClick={() => {
                if (onSendArrivalNotice) {
                  onSendArrivalNotice();
                } else {
                  alert("상대방에게 '10분 내 도착 예정입니다!' 안심 알림을 전송했습니다.");
                }
              }}
              className="w-full disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed py-3 px-3 bg-[#f0edff] hover:bg-[#e4dcfa] text-[#6c2cf5] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>[10분 전] 도착 예정 안심 알림 전송하기</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenSafetyRules}
                className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-gray-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>안심 5대 수칙</span>
              </button>
              <button
                onClick={onOpenReport}
                className="py-2.5 px-3 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-xs text-red-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>노쇼 / 비매너 신고</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 pb-2">
            {isConfirmedAppointment(appointment) && <button onClick={onCancelAppointment} className="w-full text-xs text-rose-600 py-3 rounded-xl bg-rose-50">확정 동행 취소</button>}
            <CompletionActions {...completionActions} />

            <button
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-[16px] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <MessageCircle className="w-4 h-4 text-[#6c2cf5]" />
              <span>동행 대화방 바로가기</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => alert('약속 장소 길찾기 지도 앱으로 연결됩니다.')}
                className="py-3 px-3 bg-gray-100 hover:bg-gray-200 rounded-[14px] font-semibold text-[13px] text-gray-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-4 h-4 text-gray-500" />
                <span>장소 길찾기</span>
              </button>
              <button
                onClick={() => alert('약속 링크가 클립보드에 복사되었습니다.')}
                className="py-3 px-3 bg-gray-100 hover:bg-gray-200 rounded-[14px] font-semibold text-[13px] text-gray-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-4 h-4 text-gray-500" />
                <span>동행 공유하기</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

