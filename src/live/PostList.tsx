import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { liveApi, POST_CATEGORIES, type Post, type PostFilters } from './api';
import { formatDateTime, formatRange } from './format';
import { ErrorBox, Skeleton, StatusChip } from './ui';

export const emptyFilters = (): PostFilters => ({ query: '', date: '', category: '', area: '' });

export function PostList({ filters, onChangeFilters, onSelect, reloadKey }: {
  filters: PostFilters; onChangeFilters: (filters: PostFilters) => void; onSelect: (post: Post) => void; reloadKey: number;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draftQuery, setDraftQuery] = useState(filters.query);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const current = ++sequence.current; // late responses of older filters are ignored
    setStatus('loading');
    try {
      const rows = await liveApi.listPosts(filters);
      if (current !== sequence.current) return;
      setPosts(rows); setHasMore(rows.length === 20); setStatus('ready');
    } catch (err: any) {
      if (current !== sequence.current) return;
      setError(err.message); setStatus('error');
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const loadMore = async () => {
    const last = posts.at(-1);
    if (!last) return;
    const current = sequence.current;
    setLoadingMore(true);
    try {
      const rows = await liveApi.listPosts(filters, { starts_at: last.starts_at, id: last.id });
      if (current !== sequence.current) return;
      setPosts(previous => [...previous, ...rows.filter(row => !previous.some(item => item.id === row.id))]);
      setHasMore(rows.length === 20);
    } catch (err: any) { setError(err.message); } finally { setLoadingMore(false); }
  };

  const active = [filters.query && `검색 "${filters.query}"`, filters.date && `날짜 ${filters.date}`, filters.category, filters.area && `지역 ${filters.area}`].filter(Boolean);

  return <section aria-label="동행 공고 목록" className="p-4 space-y-3 pb-28">
    <form role="search" onSubmit={event => { event.preventDefault(); onChangeFilters({ ...filters, query: draftQuery }); }} className="flex gap-2">
      <label className="relative flex-1"><span className="sr-only">공고 검색</span><Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        <input aria-label="공고 검색" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="제목·설명·지역 검색" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm" /></label>
      <button type="submit" className="px-3 rounded-xl bg-[#6c2cf5] text-white text-xs font-bold">검색</button>
    </form>
    <div className="grid grid-cols-3 gap-2">
      <input aria-label="날짜 필터" type="date" value={filters.date} onChange={event => onChangeFilters({ ...filters, date: event.target.value })} className="px-2 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs" />
      <select aria-label="카테고리 필터" value={filters.category} onChange={event => onChangeFilters({ ...filters, category: event.target.value })} className="px-2 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs">
        <option value="">전체 분류</option>{POST_CATEGORIES.map(category => <option key={category}>{category}</option>)}
      </select>
      <input aria-label="공개 지역 필터" value={filters.area} onChange={event => onChangeFilters({ ...filters, area: event.target.value })} placeholder="예: 서울특별시 성동구" className="px-2 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs" />
    </div>
    <div className="flex items-center justify-between text-[11px] text-gray-500">
      <span data-testid="post-count">{status === 'ready' ? `공고 ${posts.length}개${hasMore ? '+' : ''}` : ' '}{active.length ? ` · ${active.join(' · ')}` : ''}</span>
      {active.length > 0 && <button type="button" onClick={() => { setDraftQuery(''); onChangeFilters(emptyFilters()); }} className="font-bold text-[#6c2cf5]">필터 초기화</button>}
    </div>

    {status === 'loading' && <Skeleton />}
    {status === 'error' && <ErrorBox message={error} onRetry={() => void load()} />}
    {status === 'ready' && posts.length === 0 && <div className="text-center py-10 text-sm text-gray-500 space-y-2"><p>조건에 맞는 모집 중 공고가 없어요.</p>
      {active.length > 0 && <button type="button" onClick={() => { setDraftQuery(''); onChangeFilters(emptyFilters()); }} className="font-bold text-[#6c2cf5]">필터 초기화</button>}</div>}
    {status === 'ready' && <ul className="space-y-2.5">
      {posts.map(post => <li key={post.id}>
        <button type="button" onClick={() => onSelect(post)} className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-xs hover:border-purple-200">
          <div className="flex items-center gap-1.5 mb-1"><StatusChip>{post.category}</StatusChip><StatusChip tone="green">모집 중 · 1/2명</StatusChip></div>
          <p className="font-bold text-[15px]">{post.title}</p>
          <p className="text-xs text-gray-600 mt-1">{formatRange(post.starts_at, post.ends_at)}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{post.public_area}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">모집 마감 {formatDateTime(post.recruitment_ends_at)}{post.tags.length ? ` · #${post.tags.join(' #')}` : ''}</p>
        </button>
      </li>)}
    </ul>}
    {status === 'ready' && hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold">{loadingMore ? '불러오는 중…' : '공고 더 보기'}</button>}
  </section>;
}
