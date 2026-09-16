import { appointmentStart, demoSchedule, koreaDateKey } from '../utils/calendar';
import React, { useState, useLayoutEffect } from 'react';
import { X, Calendar, MapPin, Lock, Info, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { MeetupPost, CurrentUser } from '../types';
import { formatClock, formatMeetupRange, isValidMeetupRange } from '../utils/meetupLifecycle';

interface CreateMeetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMeetup: (newPost: MeetupPost) => boolean;
  onUpdatePost?: (updatedPost: MeetupPost) => boolean;
  editPost?: MeetupPost | null;
  currentUser: CurrentUser | null;
}

export const CreateMeetupModal: React.FC<CreateMeetupModalProps> = ({
  isOpen,
  onClose,
  onCreateMeetup,
  onUpdatePost,
  editPost,
  currentUser,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('식사');
  const [date, setDate] = useState(koreaDateKey(new Date(demoSchedule(1))));
  const [time, setTime] = useState('18:00');
  const [endDate, setEndDate] = useState(date);
  const [customDeadline, setCustomDeadline] = useState('');
  const [endTime, setEndTime] = useState('19:00');
  const [description, setDescription] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [location, setLocation] = useState('서울 강남구 대치동');
  const [publicLocation, setPublicLocation] = useState('대치역 3번 출구 앞');
  const [secretLocation, setSecretLocation] = useState('르브런치 2층 예약석');
  const [partnerPreferences, setPartnerPreferences] = useState('시간 약속 잘 지키고 편안한 대화 나누실 분 환영해요 :)');
  const [tagInput, setTagInput] = useState('#맛집탐방 #주말브런치');

  // Phase 6: Pro Paid Companion States
  const [companionType, setCompanionType] = useState<'free' | 'pro'>('free');
  const [showProRequirementModal, setShowProRequirementModal] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(25000);
  const [specialty, setSpecialty] = useState<string>('스냅 촬영 & 감성 보정');
  const [curriculum, setCurriculum] = useState<string>('10분: 촬영 컨셉 상담\n40분: 스냅 촬영\n10분: 사진 모니터링');
  const [included, setIncluded] = useState<string>('보정본 10장, 원본 전체');
  const [excluded, setExcluded] = useState<string>('카페 음료비 개인 부담');

  const isEditing = Boolean(editPost);

  const handleSelectProType = () => {
    // PRO 전문 동행 개설 조건: 당도 90 이상 및 본인인증 완료
    const isEligible = currentUser && currentUser.sugarContent >= 90 && currentUser.isPhoneVerified;
    if (!isEligible) {
      setShowProRequirementModal(true);
      return;
    }
    setCompanionType('pro');
  };

  useLayoutEffect(() => {
    setScheduleError('');
    const cutoff = editPost?.recruitmentEndsAt;
    setCustomDeadline(cutoff && cutoff !== editPost?.startsAt ? `${koreaDateKey(new Date(cutoff))}T${formatClock(cutoff)}` : '');
    if (editPost) {
      setTitle(editPost.title);
      setCategory(editPost.category);
      setDescription(editPost.description || '');
      const start = appointmentStart({ scheduledAt: editPost.startsAt, dateTime: editPost.time });
      if (Number.isFinite(start.getTime())) {
        setDate(koreaDateKey(start));
        setTime(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(start));
      }
      const hasEnd = editPost.endsAt && Number.isFinite(Date.parse(editPost.endsAt));
      setEndDate(hasEnd ? koreaDateKey(new Date(editPost.endsAt!)) : '');
      setEndTime(hasEnd ? formatClock(editPost.endsAt!) : '');
      setLocation(editPost.location);
      setPublicLocation(editPost.publicLocation || '');
      setSecretLocation(editPost.secretLocation || '');
      setPartnerPreferences(editPost.partnerPreferences || '');
      setTagInput(editPost.tags.map((t) => `#${t}`).join(' '));
      setCompanionType(editPost.companionType || 'free');
      if (editPost.proDetails) {
        setHourlyRate(editPost.proDetails.hourlyRate);
        setSpecialty(editPost.proDetails.specialty);
        setCurriculum(editPost.proDetails.curriculum.join('\n'));
        setIncluded(editPost.proDetails.included.join(', '));
        setExcluded(editPost.proDetails.excluded.join(', '));
      }
    } else {
      setTitle('');
      setCategory('식사');
      setDate(koreaDateKey(new Date(demoSchedule(1))));
      setTime('18:00');
      setEndDate(koreaDateKey(new Date(demoSchedule(1))));
      setEndTime('19:00');
      setDescription('');
      setLocation('서울 강남구 대치동');
      setPublicLocation('대치역 3번 출구 앞');
      setSecretLocation('르브런치 2층 예약석');
      setPartnerPreferences('시간 약속 잘 지키고 편안한 대화 나누실 분 환영해요 :)');
      setTagInput('#맛집탐방 #주말브런치');
      setCompanionType('free');
      setHourlyRate(25000);
      setSpecialty('스냅 촬영 & 감성 보정');
      setCurriculum('10분: 촬영 컨셉 상담\n40분: 스냅 촬영\n10분: 사진 모니터링');
      setIncluded('보정본 10장, 원본 전체');
      setExcluded('카페 음료비 개인 부담');
    }
  }, [editPost, isOpen]);

  if (!isOpen) return null;

  const categories = ['전시', '축제', '식사', '운동', '여행', '클래스', '산책', '스터디', '공연', '쇼핑', '지금', '기타'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const startValue = `${date}T${time}:00+09:00`;
    const endValue = `${endDate}T${endTime}:00+09:00`;
    if (!isValidMeetupRange(startValue, endValue)) {
      setScheduleError('종료 시각은 시작 시각보다 늦어야 해요. 다음 날 끝나면 종료 날짜도 바꿔 주세요.');
      return;
    }
    const deadline = new Date(`${customDeadline || `${date}T${time}`}:00+09:00`);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now() || deadline.getTime() > Date.parse(startValue)) {
      setScheduleError('모집 마감은 현재 시각 이후, 동행 시작 시각 이전으로 정해 주세요. 시작 시각과 같게 설정할 수도 있어요.'); return;
    }
    const startsAt = new Date(startValue).toISOString();
    const endsAt = new Date(endValue).toISOString();
    const schedule = { startsAt, endsAt, recruitmentEndsAt: deadline.toISOString(), time: formatMeetupRange(startsAt, endsAt), description: description.trim() };

    const parsedTags = tagInput
      ? tagInput
          .split(' ')
          .map((t) => t.replace('#', '').trim())
          .filter(Boolean)
      : [category, '1대1동행'];

    if (companionType === 'pro') {
      if (!parsedTags.includes('PRO전문동행')) parsedTags.unshift('PRO전문동행');
    }

    const proDetailsData = companionType === 'pro' ? {
      hourlyRate: Number(hourlyRate) || 25000,
      specialty: specialty.trim() || '맞춤 전문 동행',
      curriculum: curriculum.split('\n').map((s) => s.trim()).filter(Boolean),
      included: included.split(',').map((s) => s.trim()).filter(Boolean),
      excluded: excluded.split(',').map((s) => s.trim()).filter(Boolean),
    } : undefined;

    if (isEditing && editPost && onUpdatePost) {
      const updated: MeetupPost = {
        ...editPost,
        title: title.trim(),
        category,
        ...schedule,
        location,
        publicLocation: publicLocation.trim(),
        secretLocation: secretLocation.trim(),
        partnerPreferences: partnerPreferences.trim(),
        tags: parsedTags,
        companionType,
        proDetails: proDetailsData,
      };
      if (!onUpdatePost(updated)) return;
    } else {
      const newPost: MeetupPost = {
        id: `post-${crypto.randomUUID()}`,
        category,
        title: title.trim(),
        author: currentUser ? currentUser.maskedName : '조*미',
        authorId: currentUser ? currentUser.id : 'user-default',
        avatar: currentUser
          ? currentUser.avatar
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        ...schedule,
        location,
        publicLocation: publicLocation.trim(),
        secretLocation: secretLocation.trim(),
        partnerPreferences: partnerPreferences.trim(),
        currentMembers: 1,
        maxMembers: 2, // 1:1 동행 2인 고정
        tags: parsedTags,
        status: 'recruiting',
        companionType,
        proDetails: proDetailsData,
      };
      if (!onCreateMeetup(newPost)) return;
    }

    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={isEditing ? '동행 공고 수정' : '동행 공고 작성'} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <h3 className="text-[17px] font-bold text-gray-900">
            {isEditing ? '1:1 동행 공고 수정' : '새 1:1 동행 모집하기'}
          </h3>
          <button
            onClick={onClose} aria-label="공고 작성 창 닫기"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 1:1 Matching Fixed Notice */}
          <div className="p-3.5 bg-[#f0edff] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#6c2cf5] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                1:1
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900 block">
                  1대1 맞춤 동행 서비스
                </span>
                <span className="text-[11px] text-gray-500">
                  나 + 동행 파트너 1명 (총 2인 정원 고정)
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-[#6c2cf5] bg-white px-2.5 py-1 rounded-lg shadow-2xs">
              2/2명 고정
            </span>
          </div>

          {/* Phase 6: Companion Type Selection (Free vs PRO) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              동행 유형 선택
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompanionType('free')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  companionType === 'free'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                }`}
              >
                <span>☕ 일반 취향 동행</span>
                <span className="text-[10px] font-normal opacity-80">(무료/각자)</span>
              </button>

              <button
                type="button"
                onClick={handleSelectProType}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  companionType === 'pro'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 scale-[1.02]'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100/70'
                }`}
              >
                <span>💎 PRO 전문 동행</span>
                <span className="text-[10px] font-normal opacity-90">(유료 오퍼)</span>
              </button>
            </div>
          </div>

          {/* Pro Details Form if PRO selected */}
          {companionType === 'pro' && (
            <div className="p-4 bg-purple-50/70 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-950 flex items-center gap-1">
                  <Sparkles size={14} className="text-[#6c2cf5]" />
                  <span>PRO 유료 오퍼 상세 정보</span>
                </span>
                <span className="text-[10px] font-bold bg-[#6c2cf5] text-white px-2 py-0.5 rounded-full">
                  에스크로 보호 적용
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  시간당 희망 비용 (원)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5000"
                    min="10000"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white text-xs font-bold text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
                    placeholder="25000"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">원 / 시간</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  전문 분야 / 스킬 타이틀
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white text-xs text-gray-800 focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
                  placeholder="예: 인물 스냅 사진 & 감성 색감보정, 1:1 러닝 자세 코칭"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  활동 커리큘럼 (줄바꿈으로 구분)
                </label>
                <textarea
                  rows={2}
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white text-xs text-gray-800 focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5] resize-none"
                  placeholder="10분: 상담 및 코스 브리핑&#10;40분: 실전 1:1 동행 진행&#10;10분: 피드백 및 정리"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    포함 내역 (쉼표 구분)
                  </label>
                  <input
                    type="text"
                    value={included}
                    onChange={(e) => setIncluded(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white text-[11px] text-gray-800 focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
                    placeholder="보정본 10장, 음료 제공"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    불포함 내역 (쉼표 구분)
                  </label>
                  <input
                    type="text"
                    value={excluded}
                    onChange={(e) => setExcluded(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white text-[11px] text-gray-800 focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
                    placeholder="개인 음료비, 입장료"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Category selection */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              카테고리 선택
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    category === cat
                      ? 'bg-[#6c2cf5] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              모집 제목
            </label>
            <input
              type="text"
              required
              placeholder="예: 주말 삼청동 한옥 카페 디저트 투어 1:1 동행 가실 분!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-sm focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
            />
          </div>

          {/* Date & Time */}
          <div>
            <label htmlFor="meetup-description" className="block text-xs font-bold text-gray-600 mb-1.5">동행 상세 소개</label>
            <textarea id="meetup-description" required rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="무엇을 함께할지, 활동 순서와 준비물 등을 알려주세요." className="w-full p-3 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                시작 날짜
              </label>
              <input
                type="date"
                aria-label="시작 날짜"
                required
                value={date}
                onChange={(e) => { if (endDate === date) setEndDate(e.target.value); setDate(e.target.value); setScheduleError(''); }}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                시작 시각
              </label>
              <input
                type="time"
                aria-label="시작 시각"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="meetup-end-date" className="block text-xs font-bold text-gray-600 mb-1.5">종료 날짜</label><input id="meetup-end-date" type="date" required min={date} value={endDate} onChange={e => { setEndDate(e.target.value); setScheduleError(''); }} className="w-full px-3 py-2 rounded-xl bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" /></div>
            <div><label htmlFor="meetup-end-time" className="block text-xs font-bold text-gray-600 mb-1.5">종료 시각</label><input id="meetup-end-time" type="time" required value={endTime} onChange={e => { setEndTime(e.target.value); setScheduleError(''); }} className="w-full px-3 py-2 rounded-xl bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200" /></div>
          </div>
          <p className="text-xs text-gray-500">공고에 정한 종료 시각부터 동행 완료·평가가 가능해요.</p>
          <label className="block text-xs font-bold text-gray-600">모집 마감 날짜·시각<input type="datetime-local" required value={customDeadline || `${date}T${time}`} max={`${date}T${time}`} onChange={event => setCustomDeadline(event.target.value)} className="block w-full bg-gray-50 rounded-xl p-3 mt-2 text-xs font-normal" /></label>
          <p className="text-[11px] text-gray-500">기본값은 동행 시작 시각이에요. 이 시각부터 새 신청과 미확정 신청의 수락이 종료됩니다.</p>
          {isEditing && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl p-3">일정·장소·활동 내용이나 상대 조건을 바꾸면 기존 신청자에게 다시 확인을 받아요. 확정된 동행은 채팅의 변경 제안을 이용해 주세요.</p>}
          {scheduleError && <p role="alert" className="text-xs text-red-600">{scheduleError}</p>}

          {/* Public Location (General Area) */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              공개 만남 지역 (누구나 열람 가능)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="지역구 (예: 서울 종로구)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
              />
              <input
                type="text"
                placeholder="공개 랜드마크 (예: 안국역 2번 출구)"
                value={publicLocation}
                onChange={(e) => setPublicLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
              />
            </div>
          </div>

          {/* Secret Location (Masked for privacy) */}
          <div className="p-3.5 bg-purple-50/50 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#6c2cf5]" />
                <span>확정자 전용 상세 비밀 장소 (안심 보호 🔒)</span>
              </label>
              <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded">
                확정 시에만 공개
              </span>
            </div>
            <input
              type="text"
              placeholder="예: 어니언 안국 3번 야외 테이블, 카페 2층 카운터 앞"
              value={secretLocation}
              onChange={(e) => setSecretLocation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-white focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5] shadow-2xs"
            />
            <p className="text-[10px] text-gray-500 leading-tight">
              * 스토킹 및 개인정보 보호를 위해, 매칭이 확정된 파트너 1인에게만 이 장소가 공개됩니다.
            </p>
          </div>

          {/* Partner Preferences */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              동행 파트너에게 바라는 점 / 사전 질문
            </label>
            <textarea
              rows={2}
              placeholder="예: 편안한 분위기 좋아하시는 분, 비흡연자 선호합니다."
              value={partnerPreferences}
              onChange={(e) => setPartnerPreferences(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5] resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              태그 (공백으로 구분)
            </label>
            <input
              type="text"
              placeholder="#주말 #맛집탐방 #동네친구"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-1.5 focus:ring-[#6c2cf5]"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all"
            >
              {isEditing ? '공고 수정 완료' : '1:1 동행 등록 완료'}
            </button>
          </div>
        </form>
      </div>

      {/* PRO Host Requirement Modal Popup */}
      {showProRequirementModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-[360px] rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>

            <h4 className="text-lg font-bold text-gray-900 mb-1.5">
              PRO 전문 동행 개설 안내
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              스냅 촬영, 운동 코칭, 투어 등 유료 오퍼를 제공하는 PRO 동행은 안전한 1:1 만남과 신뢰를 위해 기준 충족 후 개설할 수 있습니다.
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-5 text-left text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${currentUser?.isPhoneVerified ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <span className="font-medium text-gray-700">휴대폰 본인확인</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  currentUser?.isPhoneVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentUser?.isPhoneVerified ? '인증 완료' : '미완료'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🍯</span>
                  <span className="font-medium text-gray-700">매너 당도 90 Brix 이상</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  (currentUser?.sugarContent || 0) >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  현재 {currentUser?.sugarContent || 50} Brix
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-gray-700">일반 동행 완료 이력</span>
                </div>
                <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  3회 이상 권장
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowProRequirementModal(false);
                setCompanionType('free');
              }}
              className="w-full py-3 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-purple-500/20 active:scale-98"
            >
              일반 취향 동행으로 모집하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
