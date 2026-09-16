import { eventStatus, eventStatusLabel } from '../utils/calendar';
import { postStatusLabel } from '../utils/postLifecycle';
import React from 'react';
import { ChevronLeft, Sparkles, MapPin, Calendar, Users } from 'lucide-react';
import { EventBannerItem, MeetupPost } from '../types';

interface EventDetailModalProps {
  now: Date;
  event: EventBannerItem | null;
  isOpen: boolean;
  onClose: () => void;
  /** Posts written for this eventId only. */
  relatedPosts: MeetupPost[];
  onSelectPost: (post: MeetupPost) => void;
  onCreateForEvent: (event: EventBannerItem) => void;
  isCovered?: boolean;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event, now,
  isOpen,
  onClose,
  relatedPosts,
  onSelectPost,
  onCreateForEvent,
  isCovered = false,
}) => {
  if (!isOpen || !event) return null;

  const status = eventStatus(event, now);
  return (
    <div role="dialog" aria-modal="true" aria-label="이벤트 상세" inert={isCovered} className="fixed inset-0 z-50 bg-[#f8f9fc] flex justify-center animate-in slide-in-from-right duration-250 text-left selection:bg-purple-100">
      {/* Mobile Page Container */}
      <div className="w-full max-w-[440px] h-full bg-[#f8f9fc] flex flex-col relative shadow-2xl overflow-hidden">
        {/* Top App Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 -ml-1.5 rounded-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <h2 className="text-[17px] font-extrabold text-gray-900 tracking-tight truncate max-w-[260px]">
              {event.title}
            </h2>
          </div>

        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto pb-10">
          {/* Banner Hero Image */}
          <div className={`relative h-64 w-full overflow-hidden ${status === 'ended' ? 'grayscale opacity-65' : ''}`}>
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Badges */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
              <span className="bg-[#ff5d2b] text-white text-xs font-bold px-2.5 py-1 rounded-[8px] shadow-sm">
                {event.badge}
              </span>
              <span className="bg-white/90 backdrop-blur-xs text-gray-900 text-xs font-bold px-2.5 py-1 rounded-[8px]">
                {event.tag}
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="flex items-center gap-1 text-[#fde047] text-xs font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>{event.subBadge}</span>
              </div>
              <h3 className="text-[22px] font-extrabold leading-tight drop-shadow-sm">
                {event.title}
              </h3>
            </div>
          </div>

          {/* Event Details Section */}
          <div className="p-4 space-y-3.5">
            <div className="bg-white p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#6c2cf5] shrink-0" />
                <span className="font-bold text-gray-900">{event.startsOn} ~ {event.endsOn} · {eventStatusLabel[status]}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#6c2cf5] shrink-0" />
                <span className="font-semibold text-gray-800">{event.tag}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-1.5">
              <h4 className="font-bold text-sm text-gray-900">이벤트 소개</h4>
              {event.sourceType === 'sample' && <span className="inline-block text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">프로토타입 예시 행사</span>}
              {event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="block text-xs text-[#6c2cf5] underline">공식 행사 정보 보기</a>}
              <p className="text-xs text-gray-600 leading-relaxed">
                {event.description}
              </p>
            </div>

            {/* Current Meetups For This Event */}
            <section aria-label="이 행사 관련 공고" data-event-id={event.id} className="pt-1">
              <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#6c2cf5]" />
                  <span>이 이벤트 관련 1:1 동행 모임</span>
                </h4>
                <span className="text-xs text-[#6c2cf5] font-bold" data-related-count={relatedPosts.length}>{relatedPosts.length}개</span>
              </div>
              <p className="text-[11px] text-gray-500 px-1 mb-3">이 행사로 작성된 공고만 보여요. 일반 공고는 탐색에서 찾을 수 있어요.</p>

              <div className="space-y-3">
                {relatedPosts.length === 0 && <p className="bg-white rounded-2xl p-5 text-xs text-gray-500">{status === 'ended' ? '종료된 행사예요. 등록된 동행이 없어요.' : '아직 이 행사에 등록된 동행이 없어요.'}</p>}
                {relatedPosts.map((post) => (
                  <button
                    type="button"
                    onClick={() => onSelectPost(post)}
                    data-post-id={post.id}
                    data-event-id={post.eventId}
                    key={post.id}
                    className="w-full text-left p-5 rounded-[24px] bg-white hover:shadow-md transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#ff5d2b] bg-[#ffebee] px-2.5 py-0.5 rounded-full">
                          {post.category}
                        </span>
                        <h5 className="font-bold text-sm text-gray-900 mt-1 leading-snug">
                          {post.title}
                        </h5>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                          post.status !== 'recruiting'
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-purple-50 text-[#6c2cf5]'
                        }`}
                      >
                        {post.status !== 'recruiting' ? postStatusLabel(post) : '1/2명 (모집중)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={post.avatar}
                          alt={post.author}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span className="font-bold text-gray-800">{post.author}</span>

                      </div>

                      <span className="px-3 py-2 rounded-xl font-bold text-xs bg-[#f0edff] text-[#6c2cf5]">공고 자세히 보기</span>
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" disabled={status === 'ended'} aria-describedby={status === 'ended' ? 'event-create-blocked' : undefined} onClick={() => onCreateForEvent(event)}
                className="mt-4 w-full py-3.5 rounded-2xl bg-[#6c2cf5] text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-500">
                이 행사로 동행 모집하기
              </button>
              {status === 'ended' && <p id="event-create-blocked" className="mt-2 text-[11px] text-gray-500 text-center">종료된 행사라 새 동행을 모집할 수 없어요. 행사 정보와 기존 공고는 계속 볼 수 있어요.</p>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
