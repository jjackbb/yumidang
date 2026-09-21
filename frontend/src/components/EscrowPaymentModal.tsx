import React, { useState } from 'react';
import { X, Clock, CreditCard } from 'lucide-react';
import type { MeetupPost } from '../types';

interface EscrowPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: MeetupPost | null;
}

export function EscrowPaymentModal({
  isOpen,
  onClose,
  post,
}: EscrowPaymentModalProps) {
  const [hours, setHours] = useState(2);
  const [method, setMethod] = useState('카카오페이');
  if (!isOpen || !post?.proDetails) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="유료 동행 미리보기"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[90dvh] overflow-y-auto space-y-5">
        <header className="flex justify-between items-start gap-3">
          <div>
            <span className="text-[10px] text-[#6c2cf5] font-bold">
              PRO · 준비 중
            </span>
            <h2 className="text-lg font-bold mt-1">유료 동행 미리보기</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="유료 동행 안내 닫기"
            className="p-2"
          >
            <X size={19} />
          </button>
        </header>
        <p className="text-xs leading-relaxed text-gray-500">
          전문 동행의 구성과 가격을 살펴보는 예시 화면이에요. 결제·예약·매칭
          확정은 진행되지 않습니다.
        </p>
        <div className="rounded-2xl bg-purple-50 p-4">
          <b className="text-sm">{post.title}</b>
          <p className="text-xs text-gray-500 mt-2">
            {post.author} · {post.proDetails.specialty}
          </p>
        </div>
        <fieldset>
          <legend className="flex gap-2 items-center text-xs font-bold mb-3">
            <Clock size={15} /> 이용 시간 예시
          </legend>
          <div className="flex gap-2">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                aria-pressed={hours === value}
                onClick={() => setHours(value)}
                className={`flex-1 py-3 rounded-xl text-xs ${hours === value ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {value}시간
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="flex gap-2 items-center text-xs font-bold mb-3">
            <CreditCard size={15} /> 결제 수단 예시
          </legend>
          <div className="flex gap-2">
            {['카카오페이', '토스페이', '카드'].map((value) => (
              <button
                key={value}
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
                className={`flex-1 py-3 rounded-xl text-[11px] ${method === value ? 'bg-purple-50 text-[#6c2cf5] ring-1 ring-purple-300' : 'bg-gray-100 text-gray-600'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-between items-center border-t border-gray-100 pt-4">
          <span className="text-xs text-gray-500">선택한 구성의 예시 금액</span>
          <b className="text-lg text-[#6c2cf5]">
            {(hours * post.proDetails.hourlyRate).toLocaleString()}원
          </b>
        </div>
        <p className="text-[11px] text-gray-500">
          실제 요금·대금 보관·취소 및 환불 정책은 서비스 도입 시 안내할
          예정이에요.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-[#6c2cf5] text-white py-3 text-sm font-bold"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
