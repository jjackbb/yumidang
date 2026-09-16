import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, CreditCard, Lock, Sparkles } from 'lucide-react';

interface KycAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAlreadyVerified: boolean;
}

export const KycAuthModal: React.FC<KycAuthModalProps> = ({
  isOpen,
  onClose,
  isAlreadyVerified,
}) => {
  const isProcessing = false;
  const [isComplete, setIsComplete] = useState(false);

  if (!isOpen) return null;

  // Preview only: no identity provider or payment is called, so no verified badge is granted.
  const handleStartKyc = () => setIsComplete(true);

  return (
    <div role="dialog" aria-modal="true" aria-label="선택형 KYC 본인확인" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6c2cf5] text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-[17px] font-bold text-gray-900">선택형 KYC 본인확인 센터</h3>
          </div>
          <button
            aria-label="본인확인 창 닫기"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isAlreadyVerified ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
              <h4 className="text-[19px] font-bold text-gray-900">본인확인 완료 계정이에요</h4>
              <button onClick={onClose} className="w-full mt-4 py-3 bg-[#6c2cf5] text-white font-bold rounded-xl text-sm">확인</button>
            </div>
          ) : isComplete ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-9 h-9" />
              </div>
              <h4 className="text-[19px] font-bold text-gray-900">인증 흐름 미리보기</h4>
              <p className="text-xs text-gray-600 leading-relaxed max-w-[300px] mx-auto">
                실제 서비스에서는 여기서 외부 신원확인 화면으로 이동해요. 이번 체험에서는 신원확인·결제를 진행하지 않았고, <strong>인증 배지도 부여되지 않아요.</strong>
              </p>
              <button
                onClick={onClose}
                className="w-full mt-4 py-3 bg-[#6c2cf5] text-white font-bold rounded-xl text-sm transition-colors"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              {/* Introduction */}
              <div className="p-4 bg-[#f8f6ff] rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-[#6c2cf5]">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold">1:1 동행 신뢰 보증 뱃지</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  외부 신원확인 기관(NICE/KCB 모바일 신분증)을 통해 신원을 검증받고, 프로필에 신뢰 마크를 달 수 있는 선택형 프리미엄 인증입니다.
                </p>
              </div>

              {/* Policy & Fee Info */}
              <div className="space-y-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl">
                <div className="flex items-start gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-gray-800 block">인증 실비 안내</span>
                    <span>외부 모바일 신분증 인증 수수료: <strong>건당 2,500원</strong> (사용자 직접 결제)</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2.5">
                  <Lock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-gray-800 block">개인정보 미보관 원칙</span>
                    <span>유미당은 주민번호나 신분증 원본을 절대 보관하지 않으며, 공인 기관의 검증 완료 여부만 안전하게 수신합니다.</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={isProcessing}
                onClick={handleStartKyc}
                className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <span>외부 신원 확인 연동 중...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>인증 흐름 미리보기 (결제·인증 없음)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
