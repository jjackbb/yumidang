import { isOpenRequest, postStatusLabel } from '../utils/postLifecycle';
import { CompanionRequests, RequestTab } from './CompanionRequests';
import React, { useState } from 'react';
import { Heart, ShieldCheck, ChevronRight, Star, Award, LogOut, Sparkles, MessageSquare, Lock, Camera, Eye, PencilLine, Inbox } from 'lucide-react';
import { Appointment, ChatMember, CurrentUser, Invitation, MeetupPost, ReviewItem, EscrowPayment, JoinRequest } from '../types';
import { ACTIVITY_TABS, myActivity, postEndedReason, type ActivityTab } from '../utils/myActivity';
import { DEMO_USER_ID } from '../data/demoIdentity';
import { avatarSrc, profileStepLabel, type ProfileStep } from '../utils/profile';

interface MyPageViewProps {
  appointments: Appointment[];
  onOpenDashboard: (appointment: Appointment) => void;
  requests: JoinRequest[];
  requestTab: RequestTab;
  onChangeRequestTab: (tab: RequestTab) => void;
  onAcceptRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  onOpenRequestPost: (id: string) => void;
  onOpenRequestChat: (id: string) => void;
  onOpenRequestProfile: (id: string) => void;
  onCancelRequest: (id: string) => void;
  onReconfirmRequest: (id: string, revision: number, agree: boolean, simulate?: boolean) => void;
  posts: MeetupPost[];
  onOpenOwnPost: (id: string) => void;
  currentUser: CurrentUser | null;
  onOpenAuth: () => void;
  onOpenKyc: () => void;
  onLogout: () => void;
  /** Required profile steps still missing (photo, interests, bio). */
  profileMissing: ProfileStep[];
  onEditProfile: (step?: ProfileStep) => void;
  onPreviewProfile: () => void;
  reviews?: ReviewItem[];
  escrowPayments?: EscrowPayment[];
  invitations: Invitation[];
  userNameOf: (userId: string) => string;
  /** The other participant of an appointment, from the viewer's side. */
  partnerOf: (appointment: Appointment) => ChatMember | undefined;
  onOpenAppointmentChat: (appointment: Appointment) => void;
  onOpenPartnerProfile: (member: ChatMember) => void;
  onOpenInvitationPost: (postId: string) => void;
  acceptBlockedReason?: (request: JoinRequest) => string | null;
}

const invitationStatusLabel: Record<Invitation['status'], string> = {
  received: '새 초대', viewed: '확인함', applied: '직접 신청함',
  post_closed: '모집 마감', post_expired: '모집 기간 만료', post_deleted: '삭제된 공고',
};

export const MyPageView: React.FC<MyPageViewProps> = ({
  invitations, userNameOf, partnerOf, onOpenAppointmentChat, onOpenPartnerProfile, onOpenInvitationPost, acceptBlockedReason,
  appointments, requests, requestTab, onChangeRequestTab, onAcceptRequest, onRejectRequest, onOpenRequestPost, onOpenRequestChat, onOpenRequestProfile, onCancelRequest, onReconfirmRequest, posts, onOpenOwnPost,
  onOpenDashboard,
  currentUser,
  onOpenAuth,
  onOpenKyc,
  onLogout,
  profileMissing,
  onEditProfile,
  onPreviewProfile,
  reviews = [],
  escrowPayments = [],
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'reviews' | 'escrow'>('info');
  const [activityTab, setActivityTab] = useState<ActivityTab>('confirmed');
  const [invitationTab, setInvitationTab] = useState<'received' | 'sent'>('received');

  if (!currentUser || !currentUser.isLoggedIn) {
    return (
      <div className="px-5 pt-12 pb-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#f0edff] text-[#6c2cf5] flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">로그인이 필요한 서비스입니다</h3>
        <p className="text-xs text-gray-500 max-w-[280px] mx-auto leading-relaxed">
          유미당은 신뢰할 수 있는 1:1 동행을 위해 간단한 휴대폰 본인확인 후 이용하실 수 있습니다.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full max-w-xs mx-auto py-3.5 bg-[#6c2cf5] text-white font-bold rounded-xl text-sm shadow-md shadow-purple-500/20 active:scale-98 transition-all"
        >
          휴대폰 본인인증으로 시작하기
        </button>
      </div>
    );
  }


  // Sample reviews in the seed belong to the example member only; everyone else shows real counts.
  const myReviews = currentUser.id === DEMO_USER_ID ? reviews : [];
  const completedCount = appointments.filter(item => item.status === '동행 완료').length;
  const averageRating = myReviews.length ? (myReviews.reduce((sum, item) => sum + item.rating, 0) / myReviews.length).toFixed(1) : '—';

  return (
    <div className="px-5 pt-3 pb-24 text-left space-y-4">
      {profileMissing.length > 0 && <section aria-label="프로필 완성 안내" data-profile-incomplete className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
        <p className="font-bold text-sm">프로필을 완성해 주세요</p>
        <p>남은 단계: {profileMissing.map(step => profileStepLabel[step]).join(' · ')}. 완성 전에는 동행 신청과 공고 작성이 제한돼요.</p>
        <button type="button" onClick={() => onEditProfile(profileMissing[0])} className="rounded-xl bg-amber-900 text-white px-3 py-2 font-bold">프로필 이어서 작성</button>
      </section>}
      <div className="-mx-5 -mt-3"><CompanionRequests userId={currentUser.id} requests={requests} posts={posts} acceptBlockedReason={acceptBlockedReason} tab={requestTab} onChangeTab={onChangeRequestTab} onAccept={onAcceptRequest} onReject={onRejectRequest} onOpenPost={onOpenRequestPost} onOpenChat={onOpenRequestChat} onOpenProfile={onOpenRequestProfile} onCancel={onCancelRequest} onReconfirm={onReconfirmRequest} /></div>
      {(() => {
        const received = invitations.filter(item => item.recipientId === currentUser.id);
        const sent = invitations.filter(item => item.senderId === currentUser.id);
        const visible = invitationTab === 'received' ? received : sent;
        return <section aria-label="초대 관리" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
          <h2 className="text-sm font-bold">초대 관리</h2>
          <p className="text-[11px] text-gray-500 mt-1">초대를 받거나 열어도 신청·확정되지 않아요. 공고를 확인하고 직접 신청해야 해요.</p>
          <div role="tablist" aria-label="초대 구분" className="flex gap-1.5 mt-3">
            {([['received', '받은 초대', received.length], ['sent', '보낸 초대', sent.length]] as const).map(([value, label, count]) =>
              <button key={value} type="button" role="tab" aria-selected={invitationTab === value} onClick={() => setInvitationTab(value)}
                className={`flex-1 rounded-xl py-2 text-xs font-bold ${invitationTab === value ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-500'}`}>{label} {count}</button>)}
          </div>
          <div role="tabpanel" aria-label={invitationTab === 'received' ? '받은 초대' : '보낸 초대'} className="mt-3 space-y-2">
            {visible.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">
              {invitationTab === 'received' ? '아직 받은 초대가 없어요.' : '아직 보낸 초대가 없어요. 내 공고를 등록한 뒤 관심친구를 초대할 수 있어요.'}
            </p>}
            {visible.map(item => {
              const post = posts.find(value => value.id === item.postId);
              return <article key={item.id} data-invitation-id={item.id} className="rounded-xl border border-gray-100 p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="font-bold">{userNameOf(invitationTab === 'received' ? item.senderId : item.recipientId)}</span><span className="text-[11px] text-[#6c2cf5]">{invitationStatusLabel[item.status]}</span></div>
                <button type="button" onClick={() => onOpenInvitationPost(item.postId)} className="mt-1 w-full text-left text-gray-700 flex items-center justify-between gap-2">{post?.title || '공고 정보를 찾을 수 없어요'}<ChevronRight size={14} className="shrink-0 text-gray-400" /></button>
              </article>;
            })}
          </div>
        </section>;
      })()}
      {(() => {
        const activity = myActivity(currentUser.id, posts, appointments);
        const appointmentList = activity[activityTab];
        return <>
          <section aria-label="내가 쓴 공고" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
            <h2 className="text-sm font-bold">내가 쓴 공고 <span className="text-[#6c2cf5]">{activity.posts.length}</span></h2>
            {activity.posts.length === 0 ? <p className="text-xs text-gray-500 py-3 text-center">아직 작성한 공고가 없어요.</p> : activity.posts.map(post => {
              const reason = postEndedReason(post);
              const waiting = requests.filter(item => item.postId === post.id && isOpenRequest(item)).length;
              return <div key={post.id} data-own-post={post.id} data-post-status={post.status} className="py-3 border-b border-gray-100 last:border-0 text-xs">
                <button type="button" onClick={() => onOpenOwnPost(post.id)} className="w-full text-left"><b className="block">{post.title}</b><span className="block text-gray-500 mt-1">{postStatusLabel(post)} · {post.time}</span></button>
                {post.status === 'recruiting' && <p className="text-[11px] text-[#6c2cf5] mt-1">확정 전 신청 {waiting}건</p>}
                {reason && <p className="text-[11px] text-gray-500 mt-1" data-post-reason>{reason}</p>}
              </div>;
            })}
          </section>
          <section aria-label="상태별 동행" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
            <h2 className="text-sm font-bold">상태별 동행</h2>
            <div role="tablist" aria-label="동행 상태" className="grid grid-cols-3 gap-1 mt-3 bg-gray-100 rounded-xl p-1">
              {ACTIVITY_TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={activityTab === item.id} data-activity-tab={item.id} onClick={() => setActivityTab(item.id)}
                className={`rounded-lg py-1.5 text-[11px] font-bold ${activityTab === item.id ? 'bg-white text-[#6c2cf5] shadow-xs' : 'text-gray-500'}`}>{item.label} {activity[item.id].length}</button>)}
            </div>
            <div role="tabpanel" aria-label={`${ACTIVITY_TABS.find(item => item.id === activityTab)!.label} 동행`} className="mt-3 space-y-2">
              {appointmentList.length === 0 && <p className="text-xs text-gray-500 py-3 text-center"><Inbox className="mx-auto mb-2 text-gray-300" size={20} />{activityTab === 'confirmed' ? '확정된 동행이 없어요.' : activityTab === 'completed' ? '완료한 동행이 없어요.' : '취소된 동행이 없어요.'}</p>}
              {appointmentList.map(item => {
                const partner = partnerOf(item);
                const post = posts.find(value => value.id === item.postId);
                return <article key={item.id} data-appointment-card={item.id} data-appointment-status={item.status} className="rounded-xl border border-gray-100 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.status === '동행 취소' ? 'bg-gray-100 text-gray-500' : 'bg-purple-50 text-[#6c2cf5]'}`}>{item.status}</span><span className="text-[11px] text-gray-400 truncate">{item.dateTime}</span></div>
                  <button type="button" onClick={() => onOpenDashboard(item)} className="w-full text-left font-bold text-sm flex items-center justify-between gap-2">{item.title}<ChevronRight size={14} className="shrink-0 text-gray-400" /></button>
                  {post && <button type="button" onClick={() => onOpenOwnPost(post.id)} className="block text-left text-[11px] text-gray-600 underline decoration-gray-300">연결 공고: {post.title}</button>}
                  {partner && <button type="button" onClick={() => onOpenPartnerProfile(partner)} aria-label={`${partner.displayName}님의 상세 프로필 보기`} className="text-[11px] text-gray-600">상대: <b>{partner.displayName}</b> · 프로필 보기</button>}
                  {item.cancellation && <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2">{item.cancellation.actorId === currentUser.id ? '내가' : '상대가'} 취소했어요 · 사유: {item.cancellation.reason}</p>}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => onOpenDashboard(item)} className="rounded-lg bg-gray-100 py-2 font-bold">약속 상세</button>
                    <button type="button" onClick={() => onOpenAppointmentChat(item)} className="rounded-lg bg-purple-50 text-[#6c2cf5] py-2 font-bold">{item.status === '동행 취소' ? '대화 내역 보기' : '대화방'}</button>
                  </div>
                </article>;
              })}
            </div>
          </section>
        </>;
      })()}
      {/* Profile Card */}
      <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              className="relative group shrink-0"
              onClick={() => onEditProfile(profileMissing.includes('photo') ? 'photo' : undefined)}
              aria-label="프로필 사진 변경"
            >
              <img
                src={avatarSrc(currentUser.avatar)}
                alt="내 프로필 사진"
                data-my-avatar
                className="w-14 h-14 rounded-full object-cover shadow-xs group-hover:opacity-90 transition-opacity"
              />
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-[#6c2cf5] rounded-full border-2 border-white flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
                <Camera className="w-2.5 h-2.5" />
              </span>
            </button>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-[17px] font-bold text-gray-900">
                  {currentUser.maskedName}
                </h3>
                {currentUser.isKycVerified ? (
                  <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" />
                    공식 KYC 인증
                  </span>
                ) : currentUser.isPhoneVerified ? (
                  <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded-full">
                    {currentUser.isSample ? '인증회원 · 예시' : '인증회원'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    인증 전
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {currentUser.neighborhood} • {currentUser.ageGroup}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="로그아웃"
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Sugar Content (당도) */}
        <div className="mt-4 pt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-gray-700">당도</span>
            <span className="font-bold text-[#6c2cf5]">{Math.round(currentUser.sugarContent)} 🍯</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#6c2cf5] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(currentUser.sugarContent, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {currentUser.isSample
              ? '예시 회원의 샘플 당도예요. 합산·하한·갱신 시점은 논의 중이에요.'
              : '신규 가입 당도 15에서 시작해요. 합산·하한·갱신 시점은 논의 중이에요.'}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-xs">
          <div className="flex flex-wrap gap-1.5">{[...(currentUser.hobbies || []), ...(currentUser.traits || [])].map(value => <span key={value} className="rounded-full bg-[#f0edff] text-[#6c2cf5] px-2.5 py-1">{value}</span>)}</div>
          <p data-my-bio className="text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-3">{currentUser.bio || '아직 자기소개가 없어요.'}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={() => onEditProfile()} className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-2.5 font-bold text-gray-800"><PencilLine size={13} />프로필 편집</button>
            <button type="button" onClick={onPreviewProfile} className="flex items-center justify-center gap-1 rounded-xl bg-[#f0edff] py-2.5 font-bold text-[#6c2cf5]"><Eye size={13} />공개 프로필 미리보기</button>
          </div>
        </div>
      </div>

      {/* Quick Stats with interactive Tab switching */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => setActiveSubTab('info')}
          className={`p-3.5 rounded-[20px] transition-all text-center ${
            activeSubTab === 'info'
              ? 'bg-[#f0edff] shadow-sm ring-1.5 ring-[#6c2cf5]'
              : 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:bg-gray-50'
          }`}
        >
          <div className="text-[18px] font-bold text-[#6c2cf5]">{completedCount}회</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">참여한 동행</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('reviews')}
          className={`p-3.5 rounded-[20px] transition-all text-center ${
            activeSubTab === 'reviews'
              ? 'bg-[#f0edff] shadow-sm ring-1.5 ring-[#6c2cf5]'
              : 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:bg-gray-50'
          }`}
        >
          <div className="text-[18px] font-bold text-amber-500">{averageRating}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">동행 평점</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('reviews')}
          className={`p-3.5 rounded-[20px] transition-all text-center ${
            activeSubTab === 'reviews'
              ? 'bg-[#f0edff] shadow-sm ring-1.5 ring-[#6c2cf5]'
              : 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:bg-gray-50'
          }`}
        >
          <div className="text-[18px] font-bold text-rose-500">{myReviews.length}개</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">받은 후기</div>
        </button>
      </div>

      {/* Subtab Toggle Buttons */}
      <div className="flex bg-gray-100 p-1 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('info')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeSubTab === 'info'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          동행 정보
        </button>
        <button
          onClick={() => setActiveSubTab('reviews')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeSubTab === 'reviews'
              ? 'bg-white text-[#6c2cf5] shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>칭찬 & 후기</span>
          <Sparkles className="w-3.5 h-3.5 text-[#6c2cf5]" />
        </button>
        <button
          onClick={() => setActiveSubTab('escrow')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeSubTab === 'escrow'
              ? 'bg-white text-purple-700 shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>에스크로</span>
          <span className="text-[10px]">💎</span>
        </button>
      </div>

      {/* View 1: Default Info & Menus */}
      {activeSubTab === 'info' && (
        <div className="space-y-4">
          {/* Menu List */}
          <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.03)] divide-y divide-gray-50">
            <button
              onClick={onOpenKyc}
              className="w-full p-4 flex items-center justify-between text-xs font-semibold text-gray-800 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#6c2cf5]" />
                <div>
                  <span className="block">선택형 KYC 본인확인 센터</span>
                  <span className="text-[11px] text-gray-400 font-normal">
                    {currentUser.isKycVerified ? '공식 인증 완료' : 'NICE/KCB 모바일 신분증 인증'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {currentUser.isKycVerified && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    인증됨
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            <button className="w-full p-4 flex items-center justify-between text-xs font-semibold text-gray-800 hover:bg-gray-50 text-left">
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>관심 등록한 동행 이벤트</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => setActiveSubTab('reviews')}
              className="w-full p-4 flex items-center justify-between text-xs font-semibold text-gray-800 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>취향 키워드 및 동행 뱃지</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* View 2: Phase 5 Reviews & Badges */}
      {activeSubTab === 'reviews' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Praise Badges Collection Card */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>이웃들이 선물한 칭찬 뱃지</span>
              </h4>
              <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded-full">
                {myReviews.length ? '예시 배지' : '0회'}
              </span>
            </div>

            {myReviews.length === 0 ? <p className="text-xs text-gray-400">아직 받은 칭찬 배지가 없어요.</p> : <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-[#f8f9fc] rounded-2xl flex items-center gap-2.5">
                <span className="text-xl">⏰</span>
                <div>
                  <span className="font-bold text-xs text-gray-900 block">시간 약속 마스터</span>
                  <span className="text-[10.5px] text-gray-400">5회 획득</span>
                </div>
              </div>

              <div className="p-3 bg-[#f8f9fc] rounded-2xl flex items-center gap-2.5">
                <span className="text-xl">😊</span>
                <div>
                  <span className="font-bold text-xs text-gray-900 block">친절하고 편안해요</span>
                  <span className="text-[10.5px] text-gray-400">4회 획득</span>
                </div>
              </div>

              <div className="p-3 bg-[#f8f9fc] rounded-2xl flex items-center gap-2.5">
                <span className="text-xl">💬</span>
                <div>
                  <span className="font-bold text-xs text-gray-900 block">대화가 즐거워요</span>
                  <span className="text-[10.5px] text-gray-400">3회 획득</span>
                </div>
              </div>

              <div className="p-3 bg-[#f8f9fc] rounded-2xl flex items-center gap-2.5">
                <span className="text-xl">🤝</span>
                <div>
                  <span className="font-bold text-xs text-gray-900 block">또 만나고 싶어요</span>
                  <span className="text-[10.5px] text-gray-400">2회 획득</span>
                </div>
              </div>
            </div>}
          </div>

          {/* Blind Unlocked Reviews List */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#6c2cf5]" />
                <span>블라인드 해제된 동행 후기</span>
              </h4>
              <span className="text-xs text-gray-400">상호 공개 완료</span>
            </div>

            {myReviews.length > 0 ? (
              <div className="space-y-3">
                {myReviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-[#f8f9fc] rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={rev.reviewerAvatar}
                          alt={rev.reviewerName}
                          className="w-7 h-7 rounded-full object-cover shadow-2xs"
                        />
                        <span className="font-bold text-gray-900">{rev.reviewerName}</span>
                        <span className="text-gray-400 text-[11px]">• {rev.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500 font-bold bg-white px-2 py-0.5 rounded-md shadow-2xs">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{rev.rating}.0</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {rev.badges.map((b, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded-lg"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    <p className="text-gray-700 leading-relaxed font-medium">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">아직 공개된 동행 후기가 없어요.</p>
            )}
          </div>
        </div>
      )}

      {/* View 3: Escrow & Pro Partner Management (Phase 6) */}
      {activeSubTab === 'escrow' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Escrow Balance & Safety Card */}
          <div className="bg-gradient-to-br from-purple-700 to-indigo-700 text-white rounded-[24px] p-5 shadow-lg shadow-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-purple-100">유료 동행 · 예시 내역</span>
              </div>
              <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                준비 중
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs text-purple-200">예시 금액 · 실제 결제 내역이 아닙니다</span>
              <div className="text-2xl font-black tracking-tight mt-0.5">
                {escrowPayments.length > 0
                  ? escrowPayments
                      .reduce((acc, p) => (p.status === 'held' ? acc + p.totalAmount : acc), 0)
                      .toLocaleString()
                  : '60,000'}
                원
              </div>
            </div>

            <p className="text-[11px] text-purple-200 mt-2 leading-relaxed">
              * 아래는 화면 구성 예시입니다. 실제 결제·예치·정산 기능은 준비 중이에요.
            </p>
          </div>

          {/* Escrow Transactions List */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center justify-between">
              <span>결제·예치 내역 미리보기</span>
              <span className="text-xs text-[#6c2cf5] font-semibold">
                {escrowPayments.length > 0 ? `${escrowPayments.length}건` : '1건'}
              </span>
            </h4>

            {escrowPayments.length > 0 ? (
              <div className="space-y-2.5">
                {escrowPayments.map((p) => (
                  <div key={p.id} className="p-3.5 bg-gray-50 rounded-2xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 truncate max-w-[200px]">{p.postTitle}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#6c2cf5]">
                        {p.status === 'held' ? '예치 예시' : '정산 예시'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500 text-[11px]">
                      <span>호스트: {p.hostName} ({p.totalHours}시간)</span>
                      <span className="font-bold text-gray-900 text-xs">
                        {p.totalAmount.toLocaleString()}원
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">{p.paidAt} • {p.paymentMethod.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-gray-50 rounded-2xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">[PRO] 성수동 감성 골목 스냅 촬영 📸</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#6c2cf5]">
                    예치 예시
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-500 text-[11px]">
                  <span>호스트: 박*준 (2시간)</span>
                  <span className="font-bold text-gray-900 text-xs">60,000원</span>
                </div>
                <div className="text-[10px] text-gray-400">예시 결제 수단 • 카카오페이</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
