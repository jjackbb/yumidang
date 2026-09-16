import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, PhoneCall, CheckCircle, Clock } from 'lucide-react';
import { Appointment } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSubmitReport: (reasonType: string, details: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onSubmitReport,
}) => {
  const [reportType, setReportType] = useState<string>('noshow');
  const [details, setDetails] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen || !appointment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitReport(reportType, details);
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setDetails('');
      onClose();
    }, 2000);
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
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">긴급 신고 및 노쇼(No-Show) 센터</h3>
              <p className="text-[11px] text-gray-500">안전 위협 및 비매너 행위 즉시 제재 접수</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-gray-900">신고가 정상 접수되었습니다</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              운영팀에서 실시간 확인 후 해당 계정 조치 및 당도 감점 처리가 진행됩니다. 안전을 최우선으로 대응하겠습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Target Partner Info */}
            <div className="p-3.5 bg-[#f8f9fc] rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <img
                  src={appointment.partnerAvatar}
                  alt={appointment.partnerName}
                  className="w-8 h-8 rounded-full object-cover shadow-2xs"
                />
                <div>
                  <span className="font-bold text-gray-900">{appointment.partnerName}</span>
                  <span className="text-[11px] text-gray-500 block">{appointment.title}</span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                신고 대상
              </span>
            </div>

            {/* Select Report Reason */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">신고 사유 선택</label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
                    reportType === 'noshow'
                      ? 'bg-red-50 text-red-950 font-semibold ring-1.5 ring-red-500'
                      : 'bg-gray-50/80 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value="noshow"
                    checked={reportType === 'noshow'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-red-500" />
                      약속 시간 20분 이상 미출현 (노쇼 발생)
                    </span>
                    <span className="text-[11px] text-gray-500">
                      연락이 두절되거나 약속 장소에 나타나지 않았습니다. (상대방 당도 대폭 감점)
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
                    reportType === 'harassment'
                      ? 'bg-red-50 text-red-950 font-semibold ring-1.5 ring-red-500'
                      : 'bg-gray-50/80 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value="harassment"
                    checked={reportType === 'harassment'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold block">불쾌한 언행 / 비매너 / 성희롱</span>
                    <span className="text-[11px] text-gray-500">
                      신체 접촉 시도, 성적 수치심 유발 또는 폭언을 경험했습니다.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
                    reportType === 'commercial'
                      ? 'bg-red-50 text-red-950 font-semibold ring-1.5 ring-red-500'
                      : 'bg-gray-50/80 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value="commercial"
                    checked={reportType === 'commercial'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold block">금전 요구 / 상업적 영업 / 종교 포교</span>
                    <span className="text-[11px] text-gray-500">
                      금전 차용 요구, 다단계 영업, 보험 권유, 포교 활동 목적이었습니다.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
                    reportType === 'danger'
                      ? 'bg-red-50 text-red-950 font-semibold ring-1.5 ring-red-500'
                      : 'bg-gray-50/80 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value="danger"
                    checked={reportType === 'danger'}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold block text-red-600">위급 상황 / 신변 위협 (긴급 SOS)</span>
                    <span className="text-[11px] text-gray-500">
                      즉각적인 신변 위협 시 즉시 경찰(112)에 전화하세요.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Details Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                구체적인 정황 설명 (선택)
              </label>
              <textarea
                rows={3}
                placeholder="상황을 구체적으로 기재해주시면 더욱 신속하게 처리됩니다."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1.5 focus:ring-red-500 resize-none text-gray-900"
              />
            </div>

            {/* Police Alert Quick Call */}
            <div className="p-3.5 bg-red-50 rounded-2xl flex items-center justify-between text-xs text-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-bold">지금 당장 위급하신가요?</span>
              </div>
              <button
                type="button"
                onClick={() => alert('경찰청 112 긴급 전화 연결 시뮬레이션입니다.')}
                className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg text-xs hover:bg-red-700 transition-colors flex items-center gap-1 shadow-xs"
              >
                <PhoneCall className="w-3 h-3" />
                112 긴급 신고
              </button>
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-md shadow-red-600/20 active:scale-98 transition-all"
              >
                신고 및 접수 완료하기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
