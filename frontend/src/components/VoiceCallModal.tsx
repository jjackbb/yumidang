import React from 'react';
import { Phone, ShieldCheck, X } from 'lucide-react';
import type { Appointment } from '../types';

export function VoiceCallModal({
  isOpen,
  onClose,
  appointment,
}: {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}) {
  if (!isOpen || !appointment) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="안심 통화 준비 안내"
      className="fixed inset-0 z-[60] bg-black/60 p-5 flex items-center justify-center"
    >
      <div className="max-w-[400px] w-full bg-white rounded-3xl p-6 text-left">
        <div className="flex justify-between">
          <span className="text-[11px] bg-purple-50 text-[#6c2cf5] rounded-full px-3 py-1 font-bold">
            후속 기능 · 준비 중
          </span>
          <button onClick={onClose} aria-label="통화 안내 닫기">
            <X size={19} />
          </button>
        </div>
        <div className="w-14 h-14 bg-purple-50 text-[#6c2cf5] rounded-2xl flex items-center justify-center mt-6 mb-4">
          <Phone size={25} />
        </div>
        <h2 className="text-xl font-bold">앱 내 안심 통화</h2>
        <p className="text-sm text-gray-500 leading-relaxed mt-2">
          매칭이 확정된 상대와 개인 전화번호를 공개하지 않고 통화하는 기능을
          준비하고 있어요.
        </p>
        <div className="mt-5 bg-gray-50 rounded-2xl p-4">
          <b className="text-sm">{appointment.partnerName}님과의 동행</b>
          <p className="text-xs text-gray-500 mt-1">{appointment.title}</p>
        </div>
        <p className="flex items-center gap-2 text-xs text-gray-500 mt-4">
          <ShieldCheck size={16} />
          지금은 채팅으로 일정과 장소를 조율해 주세요.
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-[#6c2cf5] text-white font-bold text-sm rounded-xl py-3"
        >
          채팅으로 돌아가기
        </button>
      </div>
    </div>
  );
}
