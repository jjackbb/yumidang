import React, { useState } from 'react';
import { Bot, CalendarPlus, CreditCard, DatabaseZap, Mic, Phone, RotateCcw, X } from 'lucide-react';
import type { Appointment, MeetupPost } from '../types';
import { EXPLORE_REGIONS, emptyExploreFilters, type ExploreDateFilter, type ExploreFilters } from '../utils/explore';

type Feature = 'call' | 'payment' | 'calendar' | 'ai' | 'events' | null;
const FEATURES = [
  { id: 'call', label: '안심 통화', icon: Phone },
  { id: 'payment', label: 'PRO·결제', icon: CreditCard },
  { id: 'calendar', label: '캘린더', icon: CalendarPlus },
  { id: 'ai', label: 'AI 탐색', icon: Bot },
  { id: 'events', label: '행사 수집', icon: DatabaseZap },
] as const;

function interpretedFilters(text: string): ExploreFilters {
  const query = text.trim();
  const category = ['전시', '축제', '공연', '식사', '산책', '운동', '클래스', '쇼핑'].find(value => query.includes(value)) || null;
  const region = query.includes('성수') || query.includes('성동') ? 'seongdong' : query.includes('강남') || query.includes('선정릉') ? 'gangnam' : query.includes('종로') || query.includes('안국') ? 'jongno' : query.includes('여의도') ? 'yeongdeungpo' : 'all';
  const date: ExploreDateFilter = query.includes('오늘') ? 'today' : query.includes('이번 주') || query.includes('주말') ? 'week' : 'all';
  return { ...emptyExploreFilters(), category, region, date, query: category ? '' : query };
}

export function FutureFeatureLab({ appointments, posts, now, onApplyAi }: { appointments: Appointment[]; posts: MeetupPost[]; now: Date; onApplyAi: (filters: ExploreFilters) => void }) {
  const [feature, setFeature] = useState<Feature>(null);
  const [muted, setMuted] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);
  const [aiText, setAiText] = useState('이번 주 성수 전시 동행 찾아줘');
  const [filters, setFilters] = useState<ExploreFilters>(() => interpretedFilters(aiText));
  const [collectionState, setCollectionState] = useState<'sample' | 'empty' | 'failed'>('sample');
  const appointment = appointments.find(item => ['매칭 확정', '매칭완료'].includes(item.status)) || appointments[0];
  const proPost = posts.find(item => item.companionType === 'pro');
  const regionLabel = EXPLORE_REGIONS.find(item => item.id === filters.region)?.label || '전체 지역';

  return <section aria-label="후속 기능 체험" className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
    <div><h2 className="text-sm font-bold">후속 기능 체험</h2><p className="mt-1 text-[11px] text-gray-500">기능별 앞단을 확인해요. 외부 서비스에는 연결되지 않습니다.</p></div>
    <div className="mt-3 grid grid-cols-3 gap-2">{FEATURES.map(item => <button type="button" key={item.id} onClick={() => setFeature(item.id)} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 px-2 py-2 text-[11px] font-bold text-gray-700"><item.icon size={17} className="text-[#6c2cf5]" />{item.label}</button>)}</div>
    {feature && <div role="dialog" aria-modal="true" aria-label={`${FEATURES.find(item => item.id === feature)?.label} 체험`} className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"><div className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl bg-white p-5 text-left sm:rounded-3xl">
      <header className="flex items-start justify-between"><div><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">후속 기능 · 프론트 체험</span><h3 className="mt-2 text-lg font-bold">{FEATURES.find(item => item.id === feature)?.label}</h3></div><button type="button" onClick={() => setFeature(null)} aria-label="후속 기능 체험 닫기"><X size={19} /></button></header>

      {feature === 'call' && <div className="mt-5 space-y-4"><div className="rounded-2xl bg-purple-50 p-4 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#6c2cf5]"><Phone size={25} /></div><b className="mt-3 block text-sm">{appointment?.partnerName || '확정 상대'}님</b><p className="mt-1 text-xs text-gray-500">{appointment?.title || '확정 동행을 선택해 주세요.'}</p></div><p className="text-xs leading-relaxed text-gray-600">매칭이 확정된 상대만 이용할 수 있고, 시작 전에 마이크 권한 안내가 표시돼요. 개인 번호는 화면에 공개하지 않습니다.</p><button type="button" aria-pressed={muted} onClick={() => setMuted(value => !value)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-bold"><Mic size={17} />통화 화면 미리보기 · {muted ? '음소거됨' : '마이크 켜짐'}</button><p className="text-[11px] text-amber-800">실제 통화 연결이나 연결 시간 측정은 하지 않았어요.</p></div>}

      {feature === 'payment' && <div className="mt-5 space-y-4"><div className="rounded-2xl bg-purple-50 p-4"><b className="text-sm">{proPost?.title || '전문 동행 예시'}</b><p className="mt-2 text-xs text-gray-500">{proPost?.proDetails?.specialty || '활동 구성 확인'} · 예시 2시간</p></div><div className="rounded-2xl border border-gray-100 p-4 text-xs"><p className="flex justify-between"><span>예시 금액</span><b>{((proPost?.proDetails?.hourlyRate || 30000) * 2).toLocaleString()}원</b></p><p className="mt-2 text-gray-500">구성·결제 수단·취소/환불 정책을 확인한 뒤 결제하는 화면의 앞단입니다.</p></div><button type="button" disabled className="w-full rounded-xl bg-gray-200 py-3 text-sm font-bold text-gray-500">실제 결제는 연결 전이에요</button><p className="text-[11px] text-amber-800">결제·예치·정산·환불 성공 상태를 만들지 않습니다.</p></div>}

      {feature === 'calendar' && <div className="mt-5 space-y-4"><div className="rounded-2xl bg-gray-50 p-4"><b className="text-sm">{appointment?.title || '확정 일정 없음'}</b><p className="mt-2 text-xs text-gray-500">{appointment?.dateTime || '일정이 확정되면 날짜와 장소가 표시돼요.'}</p><p className="mt-1 text-xs text-gray-500">{appointment?.location}</p></div>{calendarReady ? <div role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">외부 캘린더에 들어갈 제목·시각·장소 미리보기를 만들었어요. 실제 캘린더는 변경하지 않았습니다.</div> : <button type="button" onClick={() => setCalendarReady(true)} className="w-full rounded-xl bg-[#6c2cf5] py-3 text-sm font-bold text-white">캘린더 추가 화면 미리보기</button>}</div>}

      {feature === 'ai' && <div className="mt-5 space-y-4"><label className="block text-xs font-bold">찾고 싶은 동행<input value={aiText} onChange={event => setAiText(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label><button type="button" onClick={() => setFilters(interpretedFilters(aiText))} className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold">예시 규칙으로 조건 해석</button><div className="rounded-2xl bg-purple-50 p-4 space-y-3"><p className="text-xs font-bold">해석된 조건을 직접 수정할 수 있어요</p><label className="block text-[11px]">카테고리<input value={filters.category || ''} onChange={event => setFilters(value => ({ ...value, category: event.target.value || null }))} className="mt-1 w-full rounded-lg bg-white p-2" /></label><label className="block text-[11px]">지역<select value={filters.region} onChange={event => setFilters(value => ({ ...value, region: event.target.value }))} className="mt-1 w-full rounded-lg bg-white p-2">{EXPLORE_REGIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-[11px]">날짜<select value={filters.date} onChange={event => setFilters(value => ({ ...value, date: event.target.value as ExploreDateFilter }))} className="mt-1 w-full rounded-lg bg-white p-2"><option value="all">전체</option><option value="today">오늘</option><option value="week">7일 이내</option></select></label><p className="text-[11px] text-gray-500">현재 해석: {filters.category || '전체'} · {regionLabel} · {filters.date}</p></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setAiText(''); setFilters(emptyExploreFilters()); }} className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-3 text-xs font-bold"><RotateCcw size={14} />초기화</button><button type="button" onClick={() => { onApplyAi(filters); setFeature(null); }} className="rounded-xl bg-[#6c2cf5] py-3 text-xs font-bold text-white">둘러보기에 적용</button></div><p className="text-[11px] text-amber-800">규칙으로 만든 예시 해석이며 실제 AI 호출 결과가 아니에요.</p></div>}

      {feature === 'events' && <div className="mt-5 space-y-4"><div className="rounded-2xl bg-gray-50 p-4 text-xs"><p><b>대상 주차</b> · {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(now)}가 포함된 주</p><p className="mt-2"><b>출처 예시</b> · 공공 문화행사 데이터·공식 행사 페이지</p><p className="mt-2"><b>상태</b> · {collectionState === 'sample' ? '예시 데이터 검토' : collectionState === 'empty' ? '새로 시작한 행사 없음' : '수집 실패·재시도 필요'}</p></div><div className="grid grid-cols-3 gap-2">{(['sample','empty','failed'] as const).map(value => <button type="button" key={value} aria-pressed={collectionState === value} onClick={() => setCollectionState(value)} className={`rounded-xl py-2 text-[11px] font-bold ${collectionState === value ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100'}`}>{value === 'sample' ? '예시' : value === 'empty' ? '빈 상태' : '실패'}</button>)}</div><p className="text-[11px] leading-relaxed text-amber-800">이번 주에 시작하는 행사만 자동 생성한다는 운영안의 상태 화면입니다. 실제 크롤링·AI 생성·최신 정보 검증은 실행하지 않았어요.</p></div>}
    </div></div>}
  </section>;
}

