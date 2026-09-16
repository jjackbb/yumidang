import { postStatusLabel } from '../utils/postLifecycle';
import React, { useState } from 'react';
import { ChevronLeft, MapPin, Clock, Users, Plus, Search, Filter, Sparkles } from 'lucide-react';
import { CategoryItem, MeetupPost } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryDetailModalProps {
  category: CategoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  posts: MeetupPost[];
  onOpenCreate: () => void;
  onSelectPost?: (post: MeetupPost) => void;
}

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({
  category,
  isOpen,
  onClose,
  posts,
  onOpenCreate,
  onSelectPost,
}) => {
  const [filterRecruitingOnly, setFilterRecruitingOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  if (!isOpen || !category) return null;

  const categoryPosts = posts.filter((p) => p.category === category.name);

  const filteredPosts = categoryPosts.filter((post) => {
    if (filterRecruitingOnly && post.status !== 'recruiting') return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchTitle = post.title.toLowerCase().includes(q);
      const matchLoc = post.location.toLowerCase().includes(q);
      const matchTags = post.tags.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchLoc || matchTags;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-40 bg-[#f7f8fc] flex justify-center animate-in slide-in-from-right duration-250 text-left selection:bg-purple-100">
      {/* Mobile Page Container */}
      <div className="w-full max-w-[440px] h-full bg-[#f7f8fc] flex flex-col relative shadow-2xl overflow-hidden">
        {/* Top Minimal Header (실선 제거 및 부드러운 블러) */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 rounded-full text-gray-800 hover:text-black hover:bg-gray-100/70 active:scale-95 transition-all"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl ${category.iconBg} flex items-center justify-center shadow-2xs`}>
                <CategoryIcon type={category.iconType} className="w-4 h-4" />
              </div>
              <h2 className="text-[17px] font-extrabold text-gray-900 tracking-tight">
                {category.iconType === 'flash' ? '지금이당!' : `${category.name} 동행`}
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="px-3 py-1.5 bg-[#6c2cf5] text-white text-xs font-bold rounded-full hover:bg-[#5820d8] active:scale-95 transition-all shadow-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>모집하기</span>
          </button>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto pb-28">
          {/* Top Category Info & Search Area (실선 없이 순백색 면 분할) */}
          <div className="bg-white px-5 pt-3 pb-5 rounded-b-[28px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10.5px] font-bold text-[#6c2cf5] bg-purple-50 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                  1:1 취향 동행
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight leading-snug">
                  취향 맞는 이웃과 함께하는<br />
                  <span className="text-[#6c2cf5]">{category.name}</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  모집 중인 1:1 동행 공고를 둘러보세요
                </p>
              </div>
              <div className={`w-13 h-13 rounded-2xl ${category.iconBg} flex items-center justify-center shrink-0 shadow-xs mt-1`}>
                <CategoryIcon type={category.iconType} className="w-6 h-6" />
              </div>
            </div>

            {/* Minimal Pill Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder={`${category.name} 관련 장소나 키워드 검색...`}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100/80 rounded-2xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-200 transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            </div>

            {/* Sub Filter & Counter (미니멀 텍스트 정렬) */}
            <div className="flex items-center justify-between text-xs pt-1 px-0.5">
              <span className="text-gray-500 font-medium">
                검색 결과 <strong className="text-gray-900 font-bold">{filteredPosts.length}</strong>건
              </span>

              <button
                onClick={() => setFilterRecruitingOnly((prev) => !prev)}
                className={`px-3 py-1.5 rounded-full font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                  filterRecruitingOnly
                    ? 'bg-[#6c2cf5] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span>모집중만 보기</span>
              </button>
            </div>
          </div>

          {/* Posts List Section (탁한 테두리 실선 제거, 순백색 카드 & 부드러운 소프트 섀도우) */}
          <div className="p-4 space-y-3 mt-1">
            {filteredPosts.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-3 bg-white rounded-3xl p-6 shadow-sm">
                <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 text-[#6c2cf5] flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    등록된 {category.iconType === 'flash' ? '지금이당!' : `${category.name} 동행`}이 없습니다.
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    직접 첫 번째 1:1 동행을 제안해보세요!
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenCreate();
                  }}
                  className="mt-2 px-5 py-2.5 bg-[#6c2cf5] text-white rounded-xl text-xs font-bold hover:bg-[#5820d8] shadow-sm active:scale-95 transition-all"
                >
                  동행 모집 글 올리기
                </button>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => onSelectPost && onSelectPost(post)}
                  className="p-5 rounded-[24px] bg-white hover:shadow-md transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer space-y-3 group"
                >
                  {/* Category & Status Badges */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2.5 py-0.5 rounded-full">
                        {post.category}
                      </span>
                      {post.status !== 'recruiting' ? (
                        <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {postStatusLabel(post)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                          모집중
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        post.status !== 'recruiting'
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-purple-50 text-[#6c2cf5]'
                      }`}
                    >
                      {post.currentMembers}/2명
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-[16px] text-gray-900 leading-snug group-hover:text-[#6c2cf5] transition-colors">
                    {post.title}
                  </h4>

                  {/* Schedule & Location */}
                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 font-medium">{post.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 truncate">{post.location}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {post.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] text-gray-500 bg-gray-50 hover:bg-gray-100 px-2.5 py-0.5 rounded-lg font-medium transition-colors"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Author Profile and CTA (탁한 실선 대신 여백 분리) */}
                  <div className="flex items-center justify-between pt-3 mt-1">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={post.avatar}
                        alt={post.author}
                        className="w-8 h-8 rounded-full object-cover shadow-2xs"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-900 block leading-tight">
                          {post.author}
                        </span>
                        <span className="text-[11px] text-[#6c2cf5] font-semibold">당도 99 🍯</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectPost) onSelectPost(post);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        post.status !== 'recruiting'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#6c2cf5] text-white hover:bg-[#5820d8] active:scale-95 shadow-purple-500/20'
                      }`}
                      disabled={post.status !== 'recruiting'}
                    >
                      {post.status !== 'recruiting' ? postStatusLabel(post) : '동행 신청하기'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Fixed Action Bar (탁한 실선 제거, 플로팅 글래스모피즘 스타일) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xl p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.05)] z-20">
          <button
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-2xl text-[15px] shadow-lg shadow-purple-500/30 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>이 카테고리로 1:1 동행 모집하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
