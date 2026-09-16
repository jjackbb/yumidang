import React from 'react';
import { X, ShieldCheck, Check, AlertTriangle, PhoneCall, HeartHandshake } from 'lucide-react';

interface SafetyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export const SafetyRulesModal: React.FC<SafetyRulesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const handleAgree = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6c2cf5] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">유미당 안심 동행 5대 수칙</h3>
              <p className="text-[11px] text-gray-500">모두가 즐겁고 안전한 1:1 만남을 위한 약속</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-gray-700">
          {/* Rule Cards */}
          <div className="space-y-3">
            <div className="p-3.5 bg-[#f6f4fe] rounded-2xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6c2cf5] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">공공장소 및 오픈된 곳에서 첫 만남</h4>
                <p className="text-gray-600 leading-relaxed">
                  인적이 드문 골목이나 폐쇄된 장소가 아닌, 유동인구가 많은 지하철역 출구 앞이나 오픈된 카페에서 처음 만나세요.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#f6f4fe] rounded-2xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6c2cf5] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">음주 강요 및 과도한 음주 절대 금지</h4>
                <p className="text-gray-600 leading-relaxed">
                  상대방의 의사에 반하는 음주 권유나 2차 강요는 엄격히 금지됩니다. 적발 시 즉시 서비스 이용이 영구 정지됩니다.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#f6f4fe] rounded-2xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6c2cf5] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">금전 거래 및 사적 개인정보 요구 금지</h4>
                <p className="text-gray-600 leading-relaxed">
                  선입금, 계좌이체, 투자 권유 또는 개인 전화번호 요구 대신 앱 내 안심 채팅 및 안심 통화 기능을 이용하세요.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#f6f4fe] rounded-2xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6c2cf5] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                4
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">귀가 안심 체크 및 일정 준수</h4>
                <p className="text-gray-600 leading-relaxed">
                  동행이 끝난 후에는 안전하게 귀가하고, 약속 시간 준수를 통해 서로의 소중한 시간을 지켜주세요.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#f6f4fe] rounded-2xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6c2cf5] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                5
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">비상 상황 시 즉각 신고 센터 활용</h4>
                <p className="text-gray-600 leading-relaxed">
                  불안한 상황이 발생하면 즉시 채팅방 내의 [긴급 SOS] 버튼 또는 경찰(112)에 도움을 요청하세요. 유미당 운영팀이 긴급 개입합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Banner */}
          <div className="p-3.5 bg-gray-50 rounded-2xl flex items-center gap-2.5">
            <HeartHandshake className="w-5 h-5 text-[#6c2cf5] shrink-0" />
            <p className="text-[11px] text-gray-600 leading-tight">
              유미당은 본인인증(KYC)과 당도 지표를 통해 신뢰할 수 있는 이웃 문화를 함께 만들어갑니다.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleAgree}
              className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>안전 수칙을 준수하겠습니다</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
