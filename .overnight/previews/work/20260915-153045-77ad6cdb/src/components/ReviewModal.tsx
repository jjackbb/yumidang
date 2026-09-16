import React, { useState } from 'react';
import { X, Star, Heart, Lock, Unlock, CheckCircle2, Sparkles, Award } from 'lucide-react';
import { Appointment, ReviewItem } from '../types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  existingSubmission?: { rating: number; badges: string[]; comment: string };
  hasSettled: boolean;
  onSubmitReview: (review: {
    rating: number;
    badges: string[];
    comment: string;
  }) => boolean;
  onSettleSugar: (delta: number, partnerReview: ReviewItem) => boolean;
}

const PRAISE_BADGES = [
  { id: 'b1', label: '시간 약속을 칼같이 지켜요', icon: '⏰' },
  { id: 'b2', label: '친절하고 배려심이 넘쳐요', icon: '😊' },
  { id: 'b3', label: '대화가 편안하고 즐거워요', icon: '💬' },
  { id: 'b4', label: '식사 매너가 훌륭해요', icon: '🍽️' },
  { id: 'b5', label: '사진을 센스있게 찍어줘요', icon: '📷' },
  { id: 'b6', label: '다음에 또 동행하고 싶어요', icon: '🤝' },
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  appointment,
  existingSubmission,
  hasSettled,
  onSubmitReview,
  onSettleSugar,
}) => {
  const [rating, setRating] = useState(existingSubmission?.rating || 5);
  const [selectedBadges, setSelectedBadges] = useState<string[]>(existingSubmission?.badges || []);
  const [comment, setComment] = useState(existingSubmission?.comment || '');
  const [stage, setStage] = useState<'writing' | 'blind_waiting' | 'settled'>(hasSettled ? 'settled' : existingSubmission ? 'blind_waiting' : 'writing');

  if (!isOpen) return null;

  const toggleBadge = (label: string) => {
    setSelectedBadges((prev) =>
      prev.includes(label) ? prev.filter((b) => b !== label) : [...prev, label]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitReview({
      rating,
      badges: selectedBadges,
      comment: comment.trim(),
    })) return;

    // 1단계: 블라인드 대기 상태로 전환
    setStage('blind_waiting');

    // An explicit demo action simulates the partner; no automatic second submission.
  };

  const handlePartnerComplete = () => {
    const partnerReview: ReviewItem = {
      id: 'rev-demo-' + appointment.id,
      appointmentId: appointment.id,
      appointmentTitle: appointment.title,
      reviewerName: appointment.partnerName,
      reviewerAvatar: appointment.partnerAvatar,
      targetName: '나',
      rating: 5,
      badges: ['시간 약속을 칼같이 지켜요', '대화가 편안하고 즐거워요', '다음에 또 동행하고 싶어요'],
      comment: '너무 친절하시고 덕분에 즐겁고 편안한 동행이었습니다. 감사해요!',
      isBlind: false,
      createdAt: '방금',
    };

    if (stage !== 'blind_waiting' || !onSettleSugar(2, partnerReview)) return;
    setStage('settled');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6c2cf5] flex items-center justify-center">
              {stage === 'writing' && <Star className="w-4 h-4 fill-[#6c2cf5]" />}
              {stage === 'blind_waiting' && <Lock className="w-4 h-4 text-[#6c2cf5]" />}
              {stage === 'settled' && <Sparkles className="w-4 h-4 text-[#6c2cf5]" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {stage === 'writing' && '1:1 상호 블라인드 동행 평가'}
                {stage === 'blind_waiting' && '블라인드 평가 잠금 완료'}
                {stage === 'settled' && '상호 평가 공개 & 당도 정산'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {stage === 'writing' && '보복 방지를 위해 양측 제출 전까지 점수가 숨겨집니다.'}
                {stage === 'blind_waiting' && '상대방이 작성을 마치면 동시에 점수가 공개됩니다.'}
                {stage === 'settled' && '축하합니다! 양측 모두 만족스러운 동행을 마쳤습니다.'}
              </p>
            </div>
          </div>
          <button
            aria-label="평가창 닫기"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stage 1: Writing Form */}
        {stage === 'writing' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Target Partner Card */}
            <div className="p-3.5 bg-[#f8f9fc] rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={appointment.partnerAvatar}
                  alt={appointment.partnerName}
                  className="w-10 h-10 rounded-full object-cover shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-gray-900">{appointment.partnerName}</span>
                    <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-1.5 py-0.5 rounded">
                      1:1 파트너
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{appointment.title}</span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">
                만남 완료
              </span>
            </div>

            {/* Blind Policy Notice Box */}
            <div className="p-3 bg-purple-50/70 rounded-2xl flex items-start gap-2.5 text-xs text-[#6c2cf5]">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block text-purple-900">🔒 유미당 100% 블라인드 평가 원칙</span>
                회원님이 남기신 평가와 별점은 <strong>상대방도 평가를 완료할 때까지 절대 공개되지 않습니다.</strong> 솔직하고 안심되는 평가를 남겨주세요.
              </div>
            </div>

            {/* Star Rating */}
            <div className="text-center py-2 space-y-1.5">
              <span className="text-xs font-bold text-gray-700 block">이번 1:1 동행은 어떠셨나요?</span>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    aria-label={`${s}점`}
                    onClick={() => setRating(s)}
                    className="p-1 hover:scale-115 active:scale-95 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        s <= rating
                          ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                          : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-extrabold text-[#6c2cf5] block pt-0.5">
                {rating === 5 && '최고였어요! 꼭 다시 만나고 싶어요 ✨'}
                {rating === 4 && '즐겁고 편안한 시간이었어요 😊'}
                {rating === 3 && '보통이었어요 👍'}
                {rating === 2 && '조금 아쉬웠어요 😐'}
                {rating === 1 && '매너가 부족했어요 ⚠️'}
              </span>
            </div>

            {/* Compliment Badges Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                파트너를 위한 칭찬 뱃지 선물 (다중 선택 가능)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRAISE_BADGES.map((b) => {
                  const isSelected = selectedBadges.includes(b.label);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBadge(b.label)}
                      className={`p-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-[#f0edff] text-[#6c2cf5] ring-1.5 ring-[#6c2cf5] shadow-2xs'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-sm">{b.icon}</span>
                      <span className="truncate">{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Area */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                따뜻한 한줄 동행 후기
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="상대방에게 힘이 되는 응원과 솔직한 후기를 남겨주세요."
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5] resize-none leading-relaxed text-gray-900"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>블라인드 평가 안심 제출하기</span>
              </button>
            </div>
          </form>
        )}

        {/* Stage 2: Blind Waiting State */}
        {stage === 'blind_waiting' && (
          <div className="p-8 text-center space-y-4 animate-in fade-in">
            <div className="relative w-18 h-18 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-purple-100 animate-ping opacity-50" />
              <div className="w-16 h-16 rounded-full bg-[#f0edff] text-[#6c2cf5] flex items-center justify-center relative z-10 shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
            </div>

            <div>
              <span className="inline-block text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-0.5 rounded-full mb-1.5">
                평가 봉인 완료 🔒
              </span>
              <h4 className="text-lg font-bold text-gray-900">
                회원님의 평가가 안전하게 잠겼습니다
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed max-w-[320px] mx-auto mt-1">
                상대방({appointment.partnerName}님)이 맞평가를 완료하면 양측 점수가 동시에 해제되며 당도가 실시간 정산됩니다.
              </p>
            </div>

            {/* Progress Card */}
            <div className="bg-[#f8f9fc] rounded-2xl p-4 text-xs space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">나의 평가 제출</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 완료됨
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">{appointment.partnerName}님의 평가</span>
                <span className="font-bold text-amber-600 animate-pulse flex items-center gap-1">
                  작성 대기 중...
                </span>
              </div>
            </div>

            {/* Quick simulate unlock button */}
            <div className="p-3 bg-gray-50 rounded-xl text-left text-xs"><p className="font-bold">내가 남긴 평가 · {rating}점</p><p className="mt-1 text-gray-600 whitespace-pre-wrap">{comment}</p></div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePartnerComplete}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                상대방 평가 도착 시연 (테스트용)
              </button>
            </div>
          </div>
        )}

        {/* Stage 3: Settled & Blind Unlocked */}
        {stage === 'settled' && (
          <div className="p-6 space-y-4 animate-in zoom-in-95 text-left">
            {/* Unlocked Celebration Banner */}
            <div className="text-center py-2 space-y-1.5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Unlock className="w-8 h-8 text-emerald-500" />
              </div>
              <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                블라인드 동시 해제 완료 ✨
              </span>
              <h4 className="text-[19px] font-extrabold text-gray-900">
                상호 평가 공개 & 당도 정산 완료!
              </h4>
              <p className="text-xs text-gray-500">
                서로를 향한 따뜻한 배려로 유미당의 달콤한 신뢰가 쌓였습니다.
              </p>
            </div>

            {/* Sugar Reward Card */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-pink-500/10 rounded-[22px] flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white shadow-xs flex items-center justify-center text-xl">
                  🍯
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">당도 반영 예시</span>
                  <span className="text-[11px] text-gray-500">상대방 평가를 가정한 시연 결과</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-[#6c2cf5]">+2 🍯</span>
                <span className="text-[11px] text-emerald-600 font-bold block">정수 상승</span>
              </div>
            </div>

            {/* Partner's Review Reveal */}
            <div className="bg-[#f8f9fc] rounded-[22px] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={appointment.partnerAvatar}
                    alt={appointment.partnerName}
                    className="w-8 h-8 rounded-full object-cover shadow-2xs"
                  />
                  <div>
                    <span className="font-bold text-xs text-gray-900">{appointment.partnerName}님이 남긴 후기</span>
                    <span className="text-[10.5px] text-gray-400 block">방금 공개됨</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-amber-500 font-bold text-xs bg-white px-2 py-0.5 rounded-lg shadow-2xs">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>5.0</span>
                </div>
              </div>

              {/* Partner Badges Received */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  ⏰ 시간 약속을 칼같이 지켜요
                </span>
                <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  💬 대화가 편안하고 즐거워요
                </span>
                <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  🤝 다음에 또 동행하고 싶어요
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl text-xs text-gray-700 leading-relaxed shadow-2xs">
                "너무 친절하시고 덕분에 즐겁고 편안한 동행이었습니다. 감사해요!"
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-sm shadow-md shadow-purple-500/25 active:scale-98 transition-all"
              >
                확인 및 마이페이지에서 확인하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
