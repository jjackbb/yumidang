import { postStatusLabel } from '../utils/postLifecycle';
import React from 'react';
import { MapPin, Search, Calendar, RotateCcw, SearchX } from 'lucide-react';
import { CategoryItem, MeetupPost } from '../types';
import { EXPLORE_DATE_LABELS, EXPLORE_REGIONS, activeFilterLabels, emptyExploreFilters, filterPosts, type ExploreDateFilter, type ExploreFilters } from '../utils/explore';

interface ExploreViewProps {
  posts: MeetupPost[];
  now: Date;
  categories: CategoryItem[];
  /** Kept by the app so the filters survive opening a post and coming back. */
  filters: ExploreFilters;
  onChangeFilters: (filters: ExploreFilters) => void;
  onSelectPost: (post: MeetupPost) => void;
  authorSugarOf: (post: MeetupPost) => number | null;
  onGoHome: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ posts, now, categories, filters, onChangeFilters, onSelectPost, authorSugarOf, onGoHome }) => {
  const update = (patch: Partial<ExploreFilters>) => onChangeFilters({ ...filters, ...patch });
  const results = filterPosts(posts, filters, now);
  const labels = activeFilterLabels(filters);
  const reset = () => onChangeFilters(emptyExploreFilters());
  const chip = (active: boolean) => `px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${active ? 'bg-[#6c2cf5] text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-2xs'}`;

  return (
    <div className="px-5 pt-3 pb-24 text-left">
      <div className="mb-3">
        <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">동행 둘러보기</h2>
        <p className="text-xs text-gray-500 mt-0.5">카테고리·지역·날짜로 모집 공고를 찾아보세요.</p>
      </div>

      <section aria-label="탐색 필터" className="space-y-2.5 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" aria-hidden />
          <input type="search" aria-label="공고 검색" placeholder="제목, 장소, 태그 검색" value={filters.query} onChange={(e) => update({ query: e.target.value })}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-xs text-gray-800 placeholder-gray-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-200" />
        </div>
        <div role="group" aria-label="카테고리" className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button type="button" aria-pressed={!filters.category} onClick={() => update({ category: null })} className={chip(!filters.category)}>전체</button>
          {categories.map(category => <button key={category.id} type="button" aria-pressed={filters.category === category.name} onClick={() => update({ category: filters.category === category.name ? null : category.name })} className={chip(filters.category === category.name)}>{category.name}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-gray-600">지역
            <select aria-label="지역" value={filters.region} onChange={e => update({ region: e.target.value })} className="mt-1 block w-full rounded-xl bg-white shadow-2xs px-2.5 py-2 text-xs font-normal">
              {EXPLORE_REGIONS.map(region => <option key={region.id} value={region.id}>{region.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-bold text-gray-600">날짜 (동행 시작일)
            <select aria-label="날짜" value={filters.date} onChange={e => update({ date: e.target.value as ExploreDateFilter })} className="mt-1 block w-full rounded-xl bg-white shadow-2xs px-2.5 py-2 text-xs font-normal">
              {(Object.keys(EXPLORE_DATE_LABELS) as ExploreDateFilter[]).map(key => <option key={key} value={key}>{EXPLORE_DATE_LABELS[key]}</option>)}
            </select>
          </label>
        </div>
        {filters.date === 'date' && <input type="date" aria-label="날짜 선택" value={filters.dateValue} onChange={e => update({ dateValue: e.target.value })} className="block w-full rounded-xl bg-white shadow-2xs px-3 py-2 text-xs" />}
        <div className="flex items-center justify-between gap-2 text-xs" data-filter-summary>
          <p className="min-w-0 text-gray-600" aria-live="polite">
            <span className="block truncate">{labels.length ? `적용: ${labels.join(' · ')}` : '적용된 필터 없음'}</span>
            <span className="text-gray-900 font-bold" data-result-count={results.length}>검색 결과 {results.length}건</span>
          </p>
          <button type="button" onClick={reset} disabled={!labels.length} className="shrink-0 flex items-center gap-1 rounded-full bg-white shadow-2xs px-3 py-1.5 font-bold text-gray-700 disabled:opacity-40">
            <RotateCcw size={12} />필터 초기화
          </button>
        </div>
      </section>

      {results.length === 0 ? (
        <div role="status" data-empty-results className="rounded-3xl bg-white p-6 text-center space-y-3 shadow-xs">
          <SearchX className="mx-auto text-gray-300" />
          <p className="text-sm font-bold text-gray-800">조건에 맞는 공고가 없어요</p>
          <p className="text-xs text-gray-500">필터를 줄이거나 초기화해 보세요.</p>
          <div className="flex gap-2 justify-center">
            <button type="button" onClick={reset} className="rounded-xl bg-[#6c2cf5] text-white px-4 py-2 text-xs font-bold">필터 초기화</button>
            <button type="button" onClick={onGoHome} className="rounded-xl bg-gray-100 text-gray-700 px-4 py-2 text-xs font-bold">홈으로 돌아가기</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3" aria-label="공고 목록">
          {results.map((post) => {
            const sugar = authorSugarOf(post);
            return (
              <button type="button" key={post.id} data-post-id={post.id} data-category={post.category} data-event-id={post.eventId || ''} onClick={() => onSelectPost(post)}
                className="w-full text-left p-5 bg-white rounded-3xl hover:shadow-md transition-all shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-3 group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-0.5 rounded-full">{post.category}</span>
                    {post.companionType === 'pro' && <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full text-[10.5px]">💎 PRO</span>}
                    {post.eventId && <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[10.5px]">행사 동행</span>}
                  </div>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${post.status !== 'recruiting' ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 text-[#6c2cf5]'}`}>
                    {post.status !== 'recruiting' ? postStatusLabel(post) : '1/2명 (모집중)'}
                  </span>
                </div>
                <h4 className="font-bold text-[16px] text-gray-900 leading-snug group-hover:text-[#6c2cf5] transition-colors">{post.title}</h4>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="text-gray-700 font-medium">{post.time}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /><span className="text-gray-700 truncate">{post.location}</span></div>
                </div>
                <div className="flex items-center justify-between pt-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={post.avatar} alt="" className="w-6 h-6 rounded-full object-cover shadow-2xs" />
                    <span className="font-bold text-gray-800 truncate">{post.author}</span>
                    <span className="text-[#6c2cf5] font-semibold text-[11px] shrink-0">{sugar === null ? '당도 정보 없음' : `당도 ${sugar} 🍯`}</span>
                  </div>
                  <span className="font-bold text-[#6c2cf5] shrink-0">상세보기 &gt;</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
