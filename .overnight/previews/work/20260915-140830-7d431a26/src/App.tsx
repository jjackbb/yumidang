/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { maskRealName } from './utils/maskName';
import { trackBackEvent } from './utils/trackBackEvent';
import { trackFunnelEvent } from './utils/trackFunnelEvent';
import { Header } from './components/Header';
import { EventBanner } from './components/EventBanner';
import { AppointmentReminders } from './components/AppointmentReminders';
import { EventsView } from './components/EventsView';
import { RequestTab } from './components/CompanionRequests';
import { eventById, sampleEventsForMonth } from './data/events';
import { eventStatus } from './utils/calendar';
import { requestEligibility } from './utils/postForm';
import { emptyExploreFilters, type ExploreFilters } from './utils/explore';
import { DEMO_USER_ID } from './data/demoIdentity';
import { appointmentStart, koreaDateParts } from './utils/calendar';
import { completionAvailability, formatMeetupRange, isValidMeetupRange } from './utils/meetupLifecycle';
import { CategoryGrid } from './components/CategoryGrid';
import { BottomNav, NavTab } from './components/BottomNav';
import { DashboardModal } from './components/DashboardModal';
import { EventDetailModal } from './components/EventDetailModal';
import { CategoryDetailModal } from './components/CategoryDetailModal';
import { CreateMeetupModal } from './components/CreateMeetupModal';

import { NotificationModal } from './components/NotificationModal';
import { AuthModal } from './components/AuthModal';
import { KycAuthModal } from './components/KycAuthModal';
import { PostDetailModal } from './components/PostDetailModal';
import { JoinRequestModal } from './components/JoinRequestModal';
import { SafetyRulesModal } from './components/SafetyRulesModal';
import { VoiceCallModal } from './components/VoiceCallModal';
import { ReportModal } from './components/ReportModal';
import { ReviewModal } from './components/ReviewModal';
import { EscrowPaymentModal } from './components/EscrowPaymentModal';
import { ExploreView } from './components/ExploreView';
import { ChatView } from './components/ChatView';
import { ChatListView } from './components/ChatListView';
import { UserProfileModal } from './components/UserProfileModal';
import { ProfileEditor, type ProfilePatch } from './components/ProfileEditor';
import { BlockUserDialog, ReportUserDialog } from './components/SafetyEntryDialogs';
import { avatarSrc, missingProfileSteps, profileStepLabel, type ProfileStep } from './utils/profile';
import { isSavedBy } from './utils/relations';
import { publicProfileForMember, publicProfileForPost } from './data/publicProfiles';
import { CancellationDialog, LifecycleConfirmDialog, ScheduleConflictDialog } from './components/LifecycleDialogs';
import { cancelAppointment as cancelConfirmedAppointment, closePost, conditionsOf, confirmChangedConditions, expirePosts, isConfirmedAppointment, isOpenRequest, isRecruiting, overlappingAppointments, recruitmentDeadline, updateRecruitingPost, type LifecycleState } from './utils/postLifecycle';
import { acceptRequest, createRequestRoom, requestRoomId, roomAccess } from './utils/conversations';
import { MyPageView } from './components/MyPageView';
import { DemoControlPanel } from './components/DemoControlPanel';
import { createSeedData } from './data/prototypeSeed';
import { NEW_USER_SUGAR } from './data/publicProfiles';
import { demoNow, isDemoMode } from './utils/demoMode';
import { browserStorage, clearPrototype, loadPrototype, savePrototype, storageIssueMessage, STORAGE_KEYS, type PrototypeData, type StorageIssue } from './utils/prototypeStore';
import { canViewSecretLocation, visibleNotifications } from './utils/access';

import { mockCategories } from './data/mockData';
import { Appointment, AppointmentReview, BlockRelation, CategoryItem, ChatMember, CompletionConfirmation, DemoSettings, EventBannerItem, FavoriteFriend, Invitation, MeetupPost, CurrentUser, JoinRequest, ReviewItem, EscrowPayment, NotificationItem, NotificationSettings, ChatRoom, ScheduleProposal } from './types';

const NAV_TABS: NavTab[] = ['home', 'explore', 'chat', 'me'];

type ConflictAction =
  | { kind: 'join'; postId: string; message: string }
  | { kind: 'accept'; requestId: string; simulateHost: boolean }
  | { kind: 'proposal'; roomId: string; messageId: string; accepted: boolean; sample: boolean }
  | { kind: 'create'; post: MeetupPost };

export default function App() {
  // `?demo=1` is fixed for the page lifetime and uses its own storage key.
  const [demoMode] = useState(isDemoMode);
  const storageKey = demoMode ? STORAGE_KEYS.demo : STORAGE_KEYS.app;
  const [boot] = useState(() => {
    const loaded = loadPrototype(browserStorage(), storageKey);
    return { data: loaded.data || createSeedData(), issue: loaded.issue };
  });
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(boot.issue || null);
  // Unreadable saved data is kept untouched until the user retries or resets.
  const [autosave, setAutosave] = useState(boot.issue !== 'corrupt' && boot.issue !== 'version');

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>(() => NAV_TABS.includes(boot.data.ui.activeTab as NavTab) ? boot.data.ui.activeTab as NavTab : 'home');

  // User Auth state (Supabase Auth 연동, 체험 모드에서는 예시 계정 저장소)
  const [users, setUsers] = useState<CurrentUser[]>(boot.data.users);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() =>
    demoMode ? boot.data.users.find(user => user.id === boot.data.activeUserId) || null : null);
  const [demoSettings, setDemoSettings] = useState<DemoSettings>(boot.data.demo);
  const [favorites, setFavorites] = useState<FavoriteFriend[]>(boot.data.favorites);
  const [invitations, setInvitations] = useState<Invitation[]>(boot.data.invitations);
  const [completions, setCompletions] = useState<CompletionConfirmation[]>(boot.data.completions);
  const [appointmentReviews, setAppointmentReviews] = useState<AppointmentReview[]>(boot.data.appointmentReviews);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings[]>(boot.data.notificationSettings);
  const [blocks, setBlocks] = useState<BlockRelation[]>(boot.data.blocks);
  /** Current prototype time: real clock in service mode, shifted clock in the demo. */
  const clock = () => demoNow(demoMode ? demoSettings.timeOffsetMs : 0);

  useEffect(() => {
    if (demoMode && currentUser) setUsers(prev => prev.some(user => user.id === currentUser.id)
      ? prev.map(user => user.id === currentUser.id ? currentUser : user)
      : [...prev, currentUser]);
  }, [currentUser]);

  useEffect(() => {
    // Demo isolation: no Supabase session restore or auth listener.
    if (demoMode) return;
    // 1. 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const name = meta.realName || '유미당 회원';
        const masked = meta.maskedName || maskRealName(name);
        setCurrentUser({
          id: session.user.id,
          isLoggedIn: true,
          email: session.user.email,
          phone: session.user.phone || '010-0000-0000',
          realName: name,
          maskedName: masked,
          nickname: masked,
          gender: meta.gender || 'female',
          ageGroup: meta.ageGroup || '20대',
          neighborhood: meta.neighborhood || '서울 강남구 역삼동',
          sugarContent: NEW_USER_SUGAR,
          isPhoneVerified: false,
          isKycVerified: false,
          avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          bio: meta.bio || '유미당과 함께하는 따뜻한 동행입니다.',
          joinedAt: '2026.09',
        });
      }
    });

    // 2. Auth 상태 변화 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const name = meta.realName || '유미당 회원';
        const masked = meta.maskedName || maskRealName(name);
        setCurrentUser({
          id: session.user.id,
          isLoggedIn: true,
          email: session.user.email,
          phone: session.user.phone || '010-0000-0000',
          realName: name,
          maskedName: masked,
          nickname: masked,
          gender: meta.gender || 'female',
          ageGroup: meta.ageGroup || '20대',
          neighborhood: meta.neighborhood || '서울 강남구 역삼동',
          sugarContent: NEW_USER_SUGAR,
          isPhoneVerified: false,
          isKycVerified: false,
          avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          bio: meta.bio || '유미당과 함께하는 따뜻한 동행입니다.',
          joinedAt: '2026.09',
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Modal states
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventBannerItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);

  // Phase 2: Post Detail & Editing states
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<MeetupPost | null>(null);
  const [editingPost, setEditingPost] = useState<MeetupPost | null>(null);
  /** Where a new post starts from: a category list or one event (its eventId only). */
  const [createContext, setCreateContext] = useState<{ category?: string; eventId?: string; eventTitle?: string } | null>(null);
  const [exploreFilters, setExploreFilters] = useState<ExploreFilters>(emptyExploreFilters);

  // Phase 3: 1:1 Matching Requests & Modals
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [selectedPostForJoin, setSelectedPostForJoin] = useState<MeetupPost | null>(null);
  const [requestTab, setRequestTab] = useState<RequestTab>('sent');
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [now, setNow] = useState(clock);
  useEffect(() => {
    setNow(clock());
    const timer = setInterval(() => setNow(clock()), 60_000);
    return () => clearInterval(timer);
  }, [demoSettings.timeOffsetMs]);
  const today = koreaDateParts(now);
  const eventBanners = sampleEventsForMonth(today.year, today.month);

  // Phase 4: Safety, Voice Call & Emergency Report states
  const [isSafetyRulesOpen, setIsSafetyRulesOpen] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Phase 5: Mutual Blind Review & Sugar Settling states
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAppointmentId, setReviewAppointmentId] = useState<string | null>(null);
  const [submittedReviews, setSubmittedReviews] = useState<Record<string, { rating: number; badges: string[]; comment: string }>>({});
  const submissionLocks = useRef(new Set<string>());
  const settlementLocks = useRef(new Set<string>());

  // UI 뒤로가기/닫기 이벤트 및 체류시간 실시간 추적 (Supabase 정규화 테이블 ui_back_events)
  const modalOpenTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    if (selectedPostForDetail) {
      modalOpenTimes.current['POST_DETAIL'] = Date.now();
      trackFunnelEvent({
        step: 'POST_DETAIL_VIEW',
        targetPostId: selectedPostForDetail.id,
        pageKey: 'POST_DETAIL',
      });
    } else if (modalOpenTimes.current['POST_DETAIL']) {
      const durationMs = Date.now() - modalOpenTimes.current['POST_DETAIL'];
      delete modalOpenTimes.current['POST_DETAIL'];
      trackBackEvent({ pageKey: 'POST_DETAIL', actionType: 'close', durationMs });
    }
  }, [selectedPostForDetail]);

  useEffect(() => {
    if (selectedCategory) {
      modalOpenTimes.current['CATEGORY_DETAIL'] = Date.now();
    } else if (modalOpenTimes.current['CATEGORY_DETAIL']) {
      const durationMs = Date.now() - modalOpenTimes.current['CATEGORY_DETAIL'];
      delete modalOpenTimes.current['CATEGORY_DETAIL'];
      trackBackEvent({ pageKey: 'CATEGORY_DETAIL', actionType: 'close', durationMs });
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedEvent) {
      modalOpenTimes.current['EVENT_DETAIL'] = Date.now();
    } else if (modalOpenTimes.current['EVENT_DETAIL']) {
      const durationMs = Date.now() - modalOpenTimes.current['EVENT_DETAIL'];
      delete modalOpenTimes.current['EVENT_DETAIL'];
      trackBackEvent({ pageKey: 'EVENT_DETAIL', actionType: 'close', durationMs });
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (isCreateModalOpen) {
      modalOpenTimes.current['CREATE_MEETUP'] = Date.now();
    } else if (modalOpenTimes.current['CREATE_MEETUP']) {
      const durationMs = Date.now() - modalOpenTimes.current['CREATE_MEETUP'];
      delete modalOpenTimes.current['CREATE_MEETUP'];
      trackBackEvent({ pageKey: 'CREATE_MEETUP', actionType: 'close', durationMs });
    }
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (isAuthModalOpen) {
      modalOpenTimes.current['AUTH'] = Date.now();
    } else if (modalOpenTimes.current['AUTH']) {
      const durationMs = Date.now() - modalOpenTimes.current['AUTH'];
      delete modalOpenTimes.current['AUTH'];
      trackBackEvent({ pageKey: 'AUTH', actionType: 'close', durationMs });
    }
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (isDashboardOpen) {
      modalOpenTimes.current['DASHBOARD'] = Date.now();
    } else if (modalOpenTimes.current['DASHBOARD']) {
      const durationMs = Date.now() - modalOpenTimes.current['DASHBOARD'];
      delete modalOpenTimes.current['DASHBOARD'];
      trackBackEvent({ pageKey: 'DASHBOARD', actionType: 'close', durationMs });
    }
  }, [isDashboardOpen]);

  useEffect(() => {
    if (isJoinRequestModalOpen) {
      modalOpenTimes.current['JOIN_REQUEST'] = Date.now();
    } else if (modalOpenTimes.current['JOIN_REQUEST']) {
      const durationMs = Date.now() - modalOpenTimes.current['JOIN_REQUEST'];
      delete modalOpenTimes.current['JOIN_REQUEST'];
      trackBackEvent({ pageKey: 'JOIN_REQUEST', actionType: 'close', durationMs });
    }
  }, [isJoinRequestModalOpen]);

  const [reviews, setReviews] = useState<ReviewItem[]>(boot.data.reviews);

  // Phase 6: Pro Paid Companion & Escrow States
  const [isEscrowModalOpen, setIsEscrowModalOpen] = useState(false);
  const [selectedProPostForEscrow, setSelectedProPostForEscrow] = useState<MeetupPost | null>(null);
  const [escrowPayments] = useState<EscrowPayment[]>([
    {
      id: 'escrow-init-1',
      postId: 'post-6',
      postTitle: '[PRO] 성수동 감성 골목 인생샷 스냅 촬영 1:1 동행 📸',
      hostName: '박*준 (포토그래퍼)',
      requesterName: '조*미',
      hourlyRate: 30000,
      totalHours: 2,
      totalAmount: 60000,
      status: 'held',
      paidAt: '어제',
      paymentMethod: 'kakaopay',
    },
  ]);

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>(boot.data.requests);

  // App data states
  const [appointments, setAppointments] = useState<Appointment[]>(boot.data.appointments);
  const [activeAppointmentId, setActiveAppointmentId] = useState(boot.data.appointments[0]?.id || '');
  const appointment = appointments.find(item => item.id === activeAppointmentId) || appointments[0];
  const reviewAppointment = appointments.find(item => item.id === reviewAppointmentId) || appointment;
  const reviewKey = (id: string) => `${currentUser?.id}:${id}`;
  useEffect(() => {
    const delay = Math.min(...appointments.map(item => Date.parse(item.endsAt || '') - clock().getTime()).filter(value => value > 0));
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => setNow(clock()), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [appointments, now]);
  const setAppointment = (next: Appointment | ((previous: Appointment) => Appointment)) => {
    if (typeof next === 'function') {
      setAppointments(previous => previous.map(item => item.id === activeAppointmentId ? next(item) : item));
    } else {
      setAppointments(previous => [next, ...previous.filter(item => item.id !== next.id)]);
      setActiveAppointmentId(next.id);
    }
  };
  const openAppointment = (item: Appointment) => {
    setActiveAppointmentId(item.id);
    setIsDashboardOpen(true);
  };
  const [meetupPosts, setMeetupPosts] = useState<MeetupPost[]>(boot.data.posts);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(boot.data.rooms);
  const [postAction, setPostAction] = useState<{ id: string; mode: 'closed' | 'deleted' } | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<{ id: string; kind: 'request' | 'appointment'; title: string } | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{ conflicts: Appointment[]; action: ConflictAction } | null>(null);
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  // Profiles are opened by user id and rebuilt on every render, so edits and saves show everywhere at once.
  const [selectedChatProfile, setSelectedChatProfile] = useState<ChatMember | null>(null);
  const [profileEditor, setProfileEditor] = useState<{ mode: 'setup' | 'edit'; step?: ProfileStep; reason?: string } | null>(null);
  const [isProfilePreviewOpen, setIsProfilePreviewOpen] = useState(false);
  const [safetyDialog, setSafetyDialog] = useState<{ kind: 'report' | 'block'; member: ChatMember } | null>(null);
  const matchingLocks = useRef(new Set<string>());
  const proposalLocks = useRef(new Set<string>());
  const activeRoom = chatRooms.find(room => room.id === activeRoomId && room.members.some(member => member.id === currentUser?.id));
  const activeRoomRequest = joinRequests.find(request => request.id === activeRoom?.requestId);
  const activeRoomPost = meetupPosts.find(post => post.id === activeRoom?.postId);
  const activeRoomAppointment = appointments.find(item => item.id === activeRoom?.appointmentId);
  const activePartner = activeRoom?.members.find(member => member.id !== currentUser?.id);
  const myAppointments = appointments.filter(item => currentUser && item.participantIds?.includes(currentUser.id));
  const openRoom = (room: ChatRoom) => {
    if (!roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock()).canView) return;
    setActiveRoomId(room.id);
    if (room.appointmentId) setActiveAppointmentId(room.appointmentId);
    setActiveTab('chat');
    setNotifications(prev => prev.map(item => item.roomId === room.id ? { ...item, read: true } : item));
  };
  const openRequestRoom = (id: string) => {
    const room = chatRooms.find(room => room.requestId === id);
    if (room) openRoom(room);
  };
  const openRequestProfile = (id: string) => {
    const room = chatRooms.find(room => room.requestId === id);
    if (!room || !roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock()).canView) return;
    const member = room.members.find(member => member.id !== currentUser?.id);
    if (member) setSelectedChatProfile(member);
  };
  const updateRoomDraft = (id: string, draft: string) => setChatRooms(prev => prev.map(room => room.id === id && room.members.some(member => member.id === currentUser?.id) ? { ...room, draft } : room));
  const sendRoomMessage = (id: string, text: string, sample = false) => {
    const room = chatRooms.find(room => room.id === id);
    if (!room || !text.trim() || !roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock()).canSend || (sample && currentUser?.id !== DEMO_USER_ID)) return;
    const senderId = sample ? room.members.find(member => member.id !== currentUser!.id)!.id : currentUser!.id;
    const message = { id: crypto.randomUUID(), senderId, text: text.trim(), createdAt: new Date().toISOString(), isSample: sample };
    setChatRooms(prev => prev.map(item => item.id === id ? { ...item, draft: sample ? item.draft : '', messages: [...item.messages, message] } : item));
    if (sample) setNotifications(prev => [{ id: `notif-${message.id}`, title: '새 동행 메시지 · 시연', description: text, roomId: id, type: 'chat', time: '방금', read: false }, ...prev]);
  };
  const proposeRoomSchedule = (id: string, proposal: ScheduleProposal) => {
    const room = chatRooms.find(room => room.id === id);
    const target = appointments.find(item => item.id === room?.appointmentId);
    if (!room || !target || target.status === '동행 완료' || !roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock()).canSend || !isValidMeetupRange(proposal.startsAt, proposal.endsAt)) return;
    if (room.messages.some(item => item.proposal?.status === 'pending')) { alert('먼저 보낸 일정 변경 제안의 응답을 기다려 주세요.'); return; }
    setChatRooms(prev => prev.map(item => item.id === id ? { ...item, messages: [...item.messages, { id: crypto.randomUUID(), senderId: currentUser!.id, text: '일정·장소 변경을 제안했어요.', createdAt: new Date().toISOString(), proposal }] } : item));
  };
  const resolveRoomProposal = (roomId: string, messageId: string, accepted: boolean, sample = false, ignoreConflict = false) => {
    const room = chatRooms.find(item => item.id === roomId);
    const message = room?.messages.find(item => item.id === messageId);
    const proposal = message?.proposal;
    const target = appointments.find(item => item.id === room?.appointmentId);
    if (!room || !target || target.status === '동행 완료' || !proposal || proposal.status !== 'pending' || proposalLocks.current.has(messageId) || !roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock()).canSend) return;
    if (sample ? currentUser?.id !== DEMO_USER_ID : message.senderId === currentUser?.id) return;
    if (accepted && !isValidMeetupRange(proposal.startsAt, proposal.endsAt)) return;
    if (accepted && !ignoreConflict && warnConflict({ kind: 'proposal', roomId, messageId, accepted, sample }, target.participantIds || [], proposal.startsAt, proposal.endsAt, target.id)) return;
    proposalLocks.current.add(messageId);
    if (accepted) {
      setAppointments(prev => prev.map(item => item.id === target.id ? { ...item, scheduledAt: proposal.startsAt, endsAt: proposal.endsAt, dateTime: proposal.newDateTime, location: proposal.newLocation, addressDetail: proposal.newLocation } : item));
      setMeetupPosts(prev => prev.map(item => item.id === target.postId ? { ...item, startsAt: proposal.startsAt, endsAt: proposal.endsAt, time: proposal.newDateTime, secretLocation: proposal.newLocation } : item));
    }
    setChatRooms(prev => prev.map(item => item.id === roomId ? { ...item, messages: [...item.messages.map(value => value.id === messageId ? { ...value, proposal: { ...proposal, status: accepted ? 'accepted' as const : 'rejected' as const } } : value), { id: crypto.randomUUID(), senderId: 'system', text: accepted ? '일정 변경이 수락됐어요. 새 약속을 확인해 주세요.' : '일정 변경이 거절됐어요. 기존 약속을 유지합니다.', createdAt: new Date().toISOString(), isSample: sample }] } : item));
    setNotifications(prev => [{ id: `notif-${crypto.randomUUID()}`, title: accepted ? '약속 변경 완료' : '약속 변경 거절', description: accepted ? proposal.newDateTime : '기존 일정이 유지됩니다.', type: 'matching', roomId, time: '방금', read: false }, ...prev]);
  };
  const [notifications, setNotifications] = useState<NotificationItem[]>(boot.data.notifications);

  // Save every shared record under the versioned key (tab changes, reloads, window close).
  const snapshot = (): PrototypeData => ({
    posts: meetupPosts, requests: joinRequests, rooms: chatRooms, appointments, notifications, reviews,
    favorites, invitations, completions, appointmentReviews, notificationSettings, blocks,
    // The signed-in record is the newest copy; the users list catches up one render later.
    users: demoMode && currentUser ? (users.some(user => user.id === currentUser.id) ? users.map(user => user.id === currentUser.id ? currentUser : user) : [...users, currentUser]) : users,
    activeUserId: demoMode ? currentUser?.id || null : null, demo: demoSettings, ui: { activeTab },
  });
  const persist = () => {
    const result = savePrototype(browserStorage(), storageKey, snapshot(), clock());
    setStorageIssue('issue' in result ? result.issue : null);
  };
  useEffect(() => {
    if (autosave) persist();
  }, [autosave, meetupPosts, joinRequests, chatRooms, appointments, notifications, reviews, favorites, invitations, completions, appointmentReviews, notificationSettings, blocks, users, currentUser, demoSettings, activeTab]);
  const applyData = (data: PrototypeData, keepUserId?: string) => {
    setMeetupPosts(data.posts); setJoinRequests(data.requests); setChatRooms(data.rooms); setAppointments(data.appointments);
    setNotifications(data.notifications); setReviews(data.reviews); setFavorites(data.favorites); setInvitations(data.invitations);
    setCompletions(data.completions); setAppointmentReviews(data.appointmentReviews); setNotificationSettings(data.notificationSettings);
    setBlocks(data.blocks); setUsers(data.users); setDemoSettings(data.demo); setNow(demoNow(demoMode ? data.demo.timeOffsetMs : 0));
    setActiveAppointmentId(data.appointments[0]?.id || '');
    setActiveTab(NAV_TABS.includes(data.ui.activeTab as NavTab) ? data.ui.activeTab as NavTab : 'home');
    if (demoMode) setCurrentUser(data.users.find(user => user.id === (keepUserId || data.activeUserId)) || null);
    setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
    setSelectedPostForDetail(null); setIsNotificationsOpen(false); submissionLocks.current.clear(); settlementLocks.current.clear(); matchingLocks.current.clear(); proposalLocks.current.clear();
    setSubmittedReviews({});
  };
  const retryStorage = () => {
    if (autosave) { persist(); return; }
    const loaded = loadPrototype(browserStorage(), storageKey);
    if (loaded.data) { applyData(loaded.data); setAutosave(true); setStorageIssue(null); }
    else if (!loaded.issue) { setAutosave(true); setStorageIssue(null); }
    else setStorageIssue(loaded.issue);
  };
  /** Explicit reset of this mode's key only; the other mode's saved data is untouched. */
  const resetPrototype = () => {
    clearPrototype(browserStorage(), storageKey);
    const seed = createSeedData();
    applyData(seed, demoMode && currentUser && seed.users.some(user => user.id === currentUser.id) ? currentUser.id : undefined);
    setAutosave(true); setStorageIssue(null);
    setLifecycleNotice(demoMode ? '체험 데이터를 예시 상태로 초기화했어요.' : '저장된 프로토타입 데이터를 초기화했어요.');
  };
  const changeTimeOffset = (offsetMs: number) => {
    if (!demoMode || !Number.isFinite(offsetMs)) return;
    setDemoSettings(prev => ({ ...prev, timeOffsetMs: offsetMs }));
    setNow(demoNow(offsetMs));
  };
  const switchDemoUser = (id: string | null) => {
    if (!demoMode) return;
    const next = users.find(user => user.id === id);
    setCurrentUser(next ? { ...next, isLoggedIn: true } : null);
    setProfileEditor(null); setIsProfilePreviewOpen(false); setSafetyDialog(null);
    setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
    setIsJoinRequestModalOpen(false); setIsCreateModalOpen(false); setEditingPost(null); setRequestTab('sent');
  };

  const lifecycleState = (): LifecycleState => ({ posts: meetupPosts, requests: joinRequests, rooms: chatRooms, appointments, notifications });
  const applyLifecycle = (next: LifecycleState | null) => {
    if (!next) { setLifecycleNotice('현재 상태에서 처리할 수 없어요. 최신 공고와 신청 상태를 확인해 주세요.'); return false; }
    setMeetupPosts(next.posts); setJoinRequests(next.requests); setChatRooms(next.rooms); setAppointments(next.appointments); setNotifications(next.notifications);
    return true;
  };
  useEffect(() => {
    const next = expirePosts(lifecycleState(), now);
    if (next) applyLifecycle(next);
    const delay = Math.min(...meetupPosts.filter(post => post.status === 'recruiting').map(post => Date.parse(recruitmentDeadline(post) || '') - clock().getTime()).filter(ms => ms > 0));
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => setNow(clock()), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [meetupPosts, now]);
  useEffect(() => {
    setSelectedPostForDetail(previous => previous ? meetupPosts.find(post => post.id === previous.id) || null : null);
  }, [meetupPosts]);
  const activeMeetupPosts = meetupPosts.filter(post => post.status !== 'deleted');
  const warnConflict = (action: ConflictAction, participants: string[], startsAt?: string, endsAt?: string, excludeId?: string) => {
    const conflicts = overlappingAppointments(appointments, participants, startsAt, endsAt, excludeId);
    if (!conflicts.length) return false;
    setConflictPrompt({ conflicts, action }); return true;
  };

  const myNotifications = visibleNotifications(notifications, currentUser?.id);
  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const profileMissing = currentUser ? missingProfileSteps(currentUser) : [];
  /** Requests and posts need the basic profile; sends the member back to the first missing step. */
  const requireCompleteProfile = (action: string) => {
    if (!profileMissing.length) return true;
    // Shown inside the editor so the notice never covers its buttons.
    setProfileEditor({ mode: 'setup', step: profileMissing[0], reason: `${action} 전에 프로필을 완성해 주세요. 남은 단계: ${profileMissing.map(step => profileStepLabel[step]).join(' · ')}` });
    return false;
  };

  const handleOpenCreateMeetup = (context: { category?: string; eventId?: string } = {}) => {
    if (!currentUser || !currentUser.isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!requireCompleteProfile('공고 작성')) return;
    const event = context.eventId ? eventById(context.eventId) : undefined;
    if (context.eventId && (!event || eventStatus(event, clock()) === 'ended')) {
      setLifecycleNotice('종료된 행사에는 새 동행을 모집할 수 없어요. 행사 정보와 기존 공고는 계속 볼 수 있어요.');
      return;
    }
    setCreateContext(event ? { eventId: event.id, eventTitle: event.title, category: { 전시: '전시', 축제: '축제', 공연: '공연', 팝업: '쇼핑' }[event.kind] } : { category: context.category });
    setEditingPost(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateMeetup = (newPost: MeetupPost, ignoreConflict = false) => {
    if (!currentUser || newPost.authorId !== currentUser.id || !isRecruiting(newPost, clock())) return false;
    if (!ignoreConflict && warnConflict({ kind: 'create', post: newPost }, [currentUser.id], newPost.startsAt, newPost.endsAt)) return false;
    setMeetupPosts((prev) => [newPost, ...prev]);
    trackFunnelEvent({
      step: 'CREATE_MEETUP_SUBMIT',
      targetPostId: newPost.id,
      pageKey: 'CREATE_MEETUP',
      metadata: { category: newPost.category, title: newPost.title },
    });
    // Registration is public at once; only the author gets this confirmation (no favorite-first window).
    setNotifications((prev) => [
      {
        id: 'notif-' + crypto.randomUUID(),
        title: '공고를 등록했어요',
        description: `[${newPost.category}] "${newPost.title}" 공고가 전체 공개로 모집을 시작했어요.`,
        time: '방금', createdAt: clock().toISOString(), recipientId: currentUser.id,
        targetType: 'post', targetId: newPost.id,
        read: false,
        type: 'event',
      },
      ...prev,
    ]);
    setIsCreateModalOpen(false); setCreateContext(null);
    return true;
  };

  const handleUpdatePost = (updatedPost: MeetupPost) => {
    if (!applyLifecycle(updateRecruitingPost(lifecycleState(), updatedPost, currentUser?.id, clock()))) return false;
    setSelectedPostForDetail(updatedPost); setEditingPost(null);
    return true;
  };
  const handleClosePost = (postId: string) => setPostAction({ id: postId, mode: 'closed' });
  const handleDeletePost = (postId: string) => setPostAction({ id: postId, mode: 'deleted' });
  const confirmPostAction = () => {
    if (!postAction) return;
    const succeeded = applyLifecycle(closePost(lifecycleState(), postAction.id, postAction.mode, currentUser?.id, clock()));
    if (succeeded) setLifecycleNotice(postAction.mode === 'deleted' ? '공고를 삭제했어요. 이전 신청과 대화 기록은 남아 있어요.' : '모집을 마감했어요. 미확정 신청도 함께 종료됐어요.');
    setPostAction(null);
  };
  const handleEditPost = (post: MeetupPost) => {
    if (post.authorId !== currentUser?.id || !isRecruiting(post, clock())) { setLifecycleNotice('모집 중인 본인 공고만 수정할 수 있어요. 확정 약속은 대화방에서 변경을 제안해 주세요.'); return; }
    setEditingPost(post); setCreateContext(null); setSelectedPostForDetail(null); setIsCreateModalOpen(true);
  };
  const userById = (id: string) => users.find(user => user.id === id) || (currentUser?.id === id ? currentUser : undefined);
  /** Host-side reason an open request cannot be accepted: the requester no longer meets the partner condition. */
  const acceptBlockedReason = (request: JoinRequest) => {
    const post = meetupPosts.find(item => item.id === request.postId);
    const requester = userById(request.requesterId);
    return post && requester && !requestEligibility(post, requester).ok ? '신청자가 현재 상대 조건에 맞지 않아 수락할 수 없어요. 조건을 되돌리거나 신청을 거절해 주세요.' : null;
  };
  const handleReconfirm = (requestId: string, revision: number, agree: boolean, simulate = false) => {
    const request = joinRequests.find(item => item.id === requestId);
    if (!request || !currentUser || (simulate && (currentUser.id !== DEMO_USER_ID || request.hostId !== currentUser.id))) return;
    const requester = userById(request.requesterId);
    const post = meetupPosts.find(item => item.id === request.postId);
    if (agree && post && requester && !requestEligibility(post, requester).ok) {
      setLifecycleNotice(`${requestEligibility(post, requester).reason} 변경 조건에 동의할 수 없어요. 거절하면 신청이 종료돼요.`);
      return;
    }
    applyLifecycle(confirmChangedConditions(lifecycleState(), requestId, revision, agree, simulate ? request.requesterId : currentUser.id, clock()));
  };
  const simulatePostChange = (requestId: string) => {
    const request = joinRequests.find(item => item.id === requestId);
    const post = meetupPosts.find(item => item.id === request?.postId);
    if (currentUser?.id !== DEMO_USER_ID || request?.requesterId !== currentUser.id || !request || !isOpenRequest(request) || !post || !isRecruiting(post, clock())) return;
    const startsAt = new Date(Date.parse(post.startsAt!) + 3600000).toISOString();
    const endsAt = new Date(Date.parse(post.endsAt!) + 3600000).toISOString();
    applyLifecycle(updateRecruitingPost(lifecycleState(), { ...post, startsAt, endsAt, time: formatMeetupRange(startsAt, endsAt), publicLocation: '변경된 공개 만남 장소 · 시연' }, post.authorId, clock()));
  };

  // Phase 3: Initiate 1:1 Join Request Modal
  const handleStartJoinRequest = (post: MeetupPost) => {
    if (!currentUser || !currentUser.isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    if (currentUser.id === post.authorId) {
      alert('본인이 작성한 동행 공고에는 참여 신청할 수 없습니다.');
      return;
    }
    if (!requireCompleteProfile('동행 신청')) return;
    if (!isRecruiting(post, clock()) || post.currentMembers >= 2) {
      alert('이미 1:1 매칭이 마감된(2/2명) 공고입니다.');
      return;
    }
    if (!requestEligibility(post, currentUser).ok) {
      setLifecycleNotice(requestEligibility(post, currentUser).reason);
      return;
    }

    trackFunnelEvent({
      step: 'JOIN_REQUEST_OPEN',
      targetPostId: post.id,
      pageKey: 'JOIN_REQUEST',
    });

    setSelectedPostForJoin(post);
    setSelectedPostForDetail(null);
    setSelectedEvent(null);
    setSelectedCategory(null);
    setIsJoinRequestModalOpen(true);
  };

  // Phase 3: Submit Join Request
  const handleSendJoinRequest = (postId: string, message: string, ignoreConflict = false) => {
    const post = activeMeetupPosts.find((p) => p.id === postId);
    if (!post || !post.authorId || !currentUser || post.authorId === currentUser.id || !isRecruiting(post, clock()) || !message.trim() || !requestEligibility(post, currentUser).ok) return false;
    if (joinRequests.some(request => request.postId === post.id && request.requesterId === currentUser.id && ['pending', 'reconfirming', 'accepted'].includes(request.status))) {
      alert('이미 신청한 동행이에요. Me에서 신청 상태를 확인해 주세요.');
      return false;
    }

    if (!ignoreConflict && warnConflict({ kind: 'join', postId, message }, [currentUser.id], post.startsAt, post.endsAt)) return false;

    trackFunnelEvent({
      step: 'JOIN_REQUEST_SUBMIT',
      targetPostId: post.id,
      pageKey: 'JOIN_REQUEST',
      metadata: { messageLength: message.length },
    });

    const newReq: JoinRequest = {
      id: `req-${crypto.randomUUID()}`,
      hostId: post.authorId || '',
      postId: post.id,
      postTitle: post.title,
      requesterId: currentUser.id,
      requesterName: currentUser.maskedName,
      requesterAvatar: avatarSrc(currentUser.avatar),
      requesterSugar: currentUser.sugarContent,
      message,
      status: 'pending', conditionSnapshot: conditionsOf(post),
      createdAt: '방금',
    };

    const room = createRequestRoom(newReq, post);
    setJoinRequests((prev) => [newReq, ...prev]);
    setChatRooms(prev => [room, ...prev]);
    setActiveRoomId(room.id);
    setActiveTab('chat');

    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: '1:1 동행 참여 신청 완료', roomId: room.id,
        description: `"${post.title}" 공고에 신청했어요. 지금부터 대화할 수 있고, 작성자가 수락하면 확정됩니다.`,
        time: '방금',
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);

    setIsJoinRequestModalOpen(false); setSelectedPostForJoin(null);
    return true;
  };

  // A request enables conversation; only the host's final acceptance confirms a match.
  const handleAcceptRequest = (requestId: string, simulateHost = false, ignoreConflict = false) => {
    const targetReq = joinRequests.find(item => item.id === requestId);
    if (!targetReq || !currentUser) return;
    if (simulateHost && (currentUser.id !== DEMO_USER_ID || targetReq.requesterId !== currentUser.id)) return;
    const targetPost = meetupPosts.find(item => item.id === targetReq.postId);
    const nextRequests = acceptRequest(joinRequests, targetPost, requestId, simulateHost ? targetReq.hostId : currentUser.id, clock());
    if (!nextRequests || !targetPost || matchingLocks.current.has(targetReq.postId)) return;
    if (acceptBlockedReason(targetReq)) { setLifecycleNotice(acceptBlockedReason(targetReq)); return; }
    if (!ignoreConflict && warnConflict({ kind: 'accept', requestId, simulateHost }, [targetReq.hostId, targetReq.requesterId], targetPost.startsAt, targetPost.endsAt)) return;
    matchingLocks.current.add(targetReq.postId);
    const roomId = requestRoomId(requestId), appointmentId = `apt-${requestId}`;
    const partner = currentUser.id === targetReq.hostId
      ? { name: targetReq.requesterName, avatar: targetReq.requesterAvatar, bio: targetReq.message }
      : { name: targetPost.author, avatar: targetPost.avatar, bio: '' };
    setJoinRequests(nextRequests);
    setMeetupPosts(prev => prev.map(item => item.id === targetReq.postId ? { ...item, status: 'closed', closedReason: 'matched', currentMembers: 2 } : item));
    setAppointment({ id: appointmentId, postId: targetPost.id, scheduledAt: targetPost.startsAt, endsAt: targetPost.endsAt,
      participantIds: [targetReq.hostId, targetReq.requesterId], title: targetPost.title, dateTime: targetPost.time, location: targetPost.location,
      status: '매칭 확정', partnerName: partner.name, partnerAvatar: partner.avatar, partnerRating: 0, partnerBio: partner.bio,
      menuRecommendation: targetPost.category, addressDetail: targetPost.secretLocation || targetPost.location,
      confirmedGuests: 2, totalGuests: 2, dDay: '', appointmentBadge: '1:1 매칭 확정' });
    setChatRooms(prev => prev.map(room => {
      const request = nextRequests.find(item => item.id === room.requestId);
      if (!request || request.postId !== targetReq.postId || !joinRequests.some(item => item.id === request.id && isOpenRequest(item))) return room;
      return { ...room, appointmentId: request.id === requestId ? appointmentId : room.appointmentId,
        messages: [...room.messages, { id: crypto.randomUUID(), senderId: 'system', createdAt: new Date().toISOString(), text: request.id === requestId ? '작성자가 수락해 동행이 확정됐어요. 같은 방에서 약속을 조율하세요.' : '작성자가 다른 동행자와 확정해 이 신청이 종료됐어요.' }] };
    }));
    setNotifications(prev => [{ id: `notif-${crypto.randomUUID()}`, title: '동행 매칭 확정', description: targetPost.title, roomId, type: 'matching', time: '방금', read: false }, ...prev]);
    trackFunnelEvent({ step: 'MATCH_ACCEPT', targetPostId: targetPost.id, pageKey: 'MATCH_REQUESTS', metadata: { requesterId: targetReq.requesterId, simulated: simulateHost } });
    setActiveRoomId(roomId); setActiveTab('chat');
  };
  const endRequest = (requestId: string, status: 'rejected' | 'cancelled', reason = '') => {
    const request = joinRequests.find(item => item.id === requestId);
    if (!request || !isOpenRequest(request) || (status === 'rejected' ? request.hostId : request.requesterId) !== currentUser?.id) return false;
    const text = status === 'rejected' ? '작성자가 신청을 거절했어요.' : `신청자가 동행 신청을 취소했어요. 사유: ${reason}`;
    setJoinRequests(prev => prev.map(item => item.id === requestId && isOpenRequest(item) ? { ...item, status, cancellationReason: reason } : item));
    setChatRooms(prev => prev.map(room => room.requestId === requestId ? { ...room, messages: [...room.messages, { id: crypto.randomUUID(), senderId: 'system', text, createdAt: new Date().toISOString() }] } : room));
    setNotifications(prev => [{ id: crypto.randomUUID(), title: status === 'rejected' ? '신청 거절' : '신청 취소', description: text, roomId: requestRoomId(requestId), type: 'matching', time: '방금', read: false }, ...prev]);
    return true;
  };
  const handleRejectRequest = (id: string) => endRequest(id, 'rejected');
  const openRequestCancellation = (id: string) => {
    const request = joinRequests.find(item => item.id === id);
    if (request && isOpenRequest(request) && request.requesterId === currentUser?.id) setCancellationTarget({ id, kind: 'request', title: request.postTitle });
  };
  const openAppointmentCancellation = (target: Appointment) => {
    if (currentUser && target.participantIds?.includes(currentUser.id) && isConfirmedAppointment(target)) setCancellationTarget({ id: target.id, kind: 'appointment', title: target.title });
  };
  const confirmCancellation = (reason: string) => {
    if (!cancellationTarget) return false;
    const success = cancellationTarget.kind === 'request' ? endRequest(cancellationTarget.id, 'cancelled', reason) : applyLifecycle(cancelConfirmedAppointment(lifecycleState(), cancellationTarget.id, reason, currentUser?.id, clock()));
    if (success) setCancellationTarget(null);
    return success;
  };

  // Phase 4: Handle Emergency / No-Show Report Submit
  const handleReportSubmit = (reasonType: string, details: string) => {
    const reasonMap: Record<string, string> = {
      noshow: '20분 이상 미출현 (노쇼 발생)',
      harassment: '불쾌한 언행 / 비매너 / 성희롱',
      commercial: '금전 요구 / 상업적 영업 / 종교 포교',
      danger: '위급 상황 / 신변 위협 (긴급 SOS)',
    };
    const reasonLabel = reasonMap[reasonType] || reasonType;

    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: `🚨 [신고 접수] ${reasonLabel}`,
        description: `${appointment.partnerName} 회원에 대한 신고가 안전센터에 접수되었습니다. 상대방의 당도 패널티(-20 Brix) 검토 및 운영진 조사가 즉시 시작됩니다.`,
        time: '방금',
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);
  };

  // Phase 4: Send 10-minute Arrival Notice
  const handleSendArrivalNotice = () => {
    if (!isConfirmedAppointment(appointment)) return;
    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: '🔔 도착 예정 안심 알림 발송',
        description: `${appointment.partnerName}님에게 '약속 장소에 10분 내 도착 예정입니다!' 메시지를 전달했습니다.`,
        time: '방금',
        read: false,
        type: 'chat',
      },
      ...prev,
    ]);
    alert(`${appointment.partnerName}님에게 '약속 장소에 10분 내 도착 예정입니다!' 안심 알림을 전송했습니다.`);
  };

  // Phase 5: Mutual Blind Review Submit & Sugar Settling
  const handleOpenReview = (target: Appointment) => {
    if (!completionAvailability(target, currentUser?.id, clock()).canReview) return;
    setReviewAppointmentId(target.id);
    setIsReviewModalOpen(true);
  };

  const handleCompleteAppointment = (target: Appointment) => {
    if (!completionAvailability(target, currentUser?.id, clock()).canComplete) return;
    setAppointments(prev => prev.map(item => item.id === target.id ? { ...item, status: '동행 완료', dDay: '완료됨' } : item));
  };

  const handleSubmitReview = (reviewPayload: { rating: number; badges: string[]; comment: string }) => {
    const key = reviewKey(reviewAppointment.id);
    if (!completionAvailability(reviewAppointment, currentUser?.id, clock()).canReview || submissionLocks.current.has(key)) return false;
    submissionLocks.current.add(key);
    setSubmittedReviews(prev => ({ ...prev, [key]: reviewPayload }));
    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: '🔒 블라인드 평가 제출 완료',
        description: `${reviewAppointment.partnerName}님과의 동행 평가를 제출했습니다.`,
        time: '방금',
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);
    return true;
  };

  const handleSettleSugar = (delta: number, partnerReview: ReviewItem) => {
    const key = reviewKey(partnerReview.appointmentId);
    const target = appointments.find(item => item.id === partnerReview.appointmentId);
    if (!target || !completionAvailability(target, currentUser?.id, clock()).canReview || !submissionLocks.current.has(key) || settlementLocks.current.has(key)) return false;
    settlementLocks.current.add(key);
    // 1. 당도 정수형 가산
    setCurrentUser((prev) => {
      if (!prev) return null;
      const nextSugar = Math.min(100, Math.round(prev.sugarContent + delta));
      return {
        ...prev,
        sugarContent: nextSugar,
      };
    });

    // 3. 후기 리스트에 추가
    setReviews((prev) => [partnerReview, ...prev]);

    // 4. 시스템 알림 발송
    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: `🍯 당도 정산 완료 (+${delta} 🍯 상승!)`,
        description: `양측 블라인드 평가가 동시 해제되었습니다! ${target.partnerName}님이 칭찬 뱃지를 선물했습니다.`,
        time: '방금',
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);
    return true;
  };

  const handleAuthSuccess = (authenticated: CurrentUser, kind: 'signup' | 'signin' = 'signin') => {
    // In the demo an existing account keeps its saved profile edits.
    const stored = demoMode ? users.find(user => user.id === authenticated.id) : undefined;
    const newUser = stored ? { ...stored, isLoggedIn: true } : authenticated;
    setCurrentUser(newUser);
    if (!demoMode) setUsers(prev => prev.some(user => user.id === newUser.id) ? prev : [...prev, newUser]);
    // First signup or a login with an unfinished profile continues at the first missing step.
    const missing = missingProfileSteps(newUser);
    if (missing.length) setProfileEditor({ mode: 'setup', step: missing[0] });
    if (pendingRoomId && chatRooms.some(room => room.id === pendingRoomId && room.members.some(member => member.id === newUser.id))) {
      setActiveRoomId(pendingRoomId); setActiveTab('chat');
      const room = chatRooms.find(room => room.id === pendingRoomId)!;
      if (room.appointmentId) setActiveAppointmentId(room.appointmentId);
      setNotifications(prev => prev.map(item => item.roomId === room.id ? { ...item, read: true } : item));
      setPendingRoomId(null);
    }
    setNotifications((prev) => [
      {
        id: 'notif-' + Date.now(),
        title: kind === 'signup' ? '가입을 환영해요' : '로그인했어요',
        description: kind === 'signup'
          ? `${newUser.maskedName}님, 사진·취미·소개를 채우면 동행을 신청할 수 있어요.`
          : `${newUser.maskedName}님, 다시 만나서 반가워요.`,
        time: '방금', createdAt: clock().toISOString(), recipientId: newUser.id,
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);
  };

  const commitProfile = (patch: ProfilePatch) => setCurrentUser(prev => prev ? { ...prev, ...patch } : prev);
  const selfMember = (user: CurrentUser): ChatMember => ({ id: user.id, displayName: user.maskedName, avatar: user.avatar });
  const toggleFavorite = (targetId: string) => {
    if (!currentUser || targetId === currentUser.id || blocks.some(item => item.blockerId === currentUser.id && item.blockedId === targetId)) return;
    // Private one-way save: no notification is created for the target.
    setFavorites(prev => isSavedBy(currentUser.id, targetId, prev)
      ? prev.filter(item => !(item.ownerId === currentUser.id && item.targetId === targetId))
      : [...prev, { ownerId: currentUser.id, targetId, savedAt: clock().toISOString(), notifyNewPosts: true }]);
  };
  const activeAppointmentsWith = (targetId: string) => appointments.filter(item =>
    currentUser && item.participantIds?.includes(currentUser.id) && item.participantIds.includes(targetId) && isConfirmedAppointment(item));
  const confirmBlock = (member: ChatMember) => {
    if (!currentUser || member.id === currentUser.id) return;
    let state: LifecycleState | null = lifecycleState();
    for (const item of activeAppointmentsWith(member.id)) {
      const next = cancelConfirmedAppointment(state!, item.id, '차단으로 동행 취소', currentUser.id, clock());
      if (next) state = next;
    }
    applyLifecycle(state);
    setBlocks(prev => prev.some(item => item.blockerId === currentUser.id && item.blockedId === member.id) ? prev : [...prev, { blockerId: currentUser.id, blockedId: member.id, createdAt: clock().toISOString() }]);
    setSafetyDialog(null);
    setLifecycleNotice(`${member.displayName}님을 차단했어요. 완료된 동행 기록은 그대로 남아 있어요.`);
  };

  const handleLogout = async () => {
    if (!demoMode) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setCurrentUser(null);
    setProfileEditor(null); setIsProfilePreviewOpen(false); setSafetyDialog(null);
    setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
  };


  // Phase 6: Pro Escrow Payment Handlers
  const handleOpenEscrow = (post: MeetupPost) => {
    setSelectedPostForDetail(null);
    setSelectedProPostForEscrow(post);
    setIsEscrowModalOpen(true);
  };

  const postAuthor = (post: MeetupPost): ChatMember => ({ id: post.authorId || `unknown-${post.id}`, displayName: post.author, avatar: post.avatar });
  const authorSugarOf = (post: MeetupPost) => publicProfileForPost(post, currentUser, users).sugarContent;
  /** The other participant, seen from the signed-in user (the stored partnerName is only the accepting side's view). */
  const partnerOf = (target: Appointment): ChatMember | undefined => {
    const member = chatRooms.find(room => room.appointmentId === target.id)?.members.find(item => item.id !== currentUser?.id);
    if (member) return member;
    const otherId = target.participantIds?.find(id => id !== currentUser?.id);
    const account = otherId ? userById(otherId) : undefined;
    return otherId ? { id: otherId, displayName: account?.maskedName || target.partnerName, avatar: account?.avatar || target.partnerAvatar } : undefined;
  };
  const detailEvent = selectedPostForDetail?.eventId ? eventById(selectedPostForDetail.eventId) : undefined;
  const dashboardPartner = chatRooms.find(room => room.appointmentId === appointment.id)?.members.find(member => member.id !== currentUser?.id);
  const dashboardProfile = dashboardPartner ? publicProfileForMember(dashboardPartner, currentUser, users) : undefined;
  const completionActionsFor = (target: Appointment) => ({
    availability: completionAvailability(target, currentUser?.id, now),
    isCompleted: target.status === '동행 완료',
    hasSubmittedReview: Boolean(submittedReviews[reviewKey(target.id)]),
    onComplete: () => handleCompleteAppointment(target),
    onOpenReview: () => handleOpenReview(target),
  });
  const existingPostRoom = selectedPostForDetail && chatRooms.find(room =>
    room.postId === selectedPostForDetail.id &&
    room.members.some(member => member.id === currentUser?.id) &&
    (room.appointmentId || joinRequests.some(request => request.id === room.requestId && isOpenRequest(request)))
  );

  const continueConflict = () => {
    const action = conflictPrompt?.action; setConflictPrompt(null);
    if (!action) return;
    if (action.kind === 'join') handleSendJoinRequest(action.postId, action.message, true);
    if (action.kind === 'accept') handleAcceptRequest(action.requestId, action.simulateHost, true);
    if (action.kind === 'proposal') resolveRoomProposal(action.roomId, action.messageId, action.accepted, action.sample, true);
    if (action.kind === 'create') handleCreateMeetup(action.post, true);
  };

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex justify-center selection:bg-purple-100">
      {/* Mobile container simulating the exact mobile app interface */}
      <main className="w-full max-w-[440px] min-h-screen bg-white shadow-xl relative flex flex-col">
        {demoMode && <DemoControlPanel
          users={users} activeUserId={currentUser?.id || null} now={now} settings={demoSettings}
          onSwitchUser={switchDemoUser}
          onSetTimeOffset={changeTimeOffset}
          onSetTime={iso => changeTimeOffset(Date.parse(iso) - Date.now())}
          onChangeVariant={(key, value) => setDemoSettings(prev => ({ ...prev, variants: { ...prev.variants, [key]: value } }))}
          onReset={resetPrototype}
        />}
        {storageIssue && <div role="alert" data-storage-issue={storageIssue} className="bg-red-50 text-red-900 text-xs px-4 py-2.5 border-b border-red-100">
          <p className="leading-relaxed">{storageIssueMessage[storageIssue]}</p>
          <div className="flex gap-2 mt-1.5 justify-end">
            <button type="button" onClick={retryStorage} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 font-bold">저장 다시 시도</button>
            <button type="button" onClick={resetPrototype} className="rounded-lg bg-red-600 text-white px-2.5 py-1 font-bold">저장 데이터 초기화</button>
          </div>
        </div>}
        {/* Top Header */}
        <Header
          unreadCount={unreadNotifCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        {currentUser && profileMissing.length > 0 && !profileEditor && activeTab !== 'me' && <div role="status" data-profile-incomplete-bar className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-950">
          <span className="flex-1 min-w-0">프로필 미완성 · 남은 단계 {profileMissing.map(step => profileStepLabel[step]).join(' · ')}</span>
          <button type="button" onClick={() => setProfileEditor({ mode: 'setup', step: profileMissing[0] })} className="shrink-0 rounded-lg bg-amber-900 text-white px-2.5 py-1 font-bold">이어서 작성</button>
        </div>}

        {/* Tab 1: Home View */}
        {activeTab === 'home' && (
          <div className="flex-1 overflow-y-auto pb-24">
            {/* 1. 9월 2주차 주목할 이벤트 */}
            <EventBanner
              events={eventBanners}
              now={now}
              onSelectEvent={(event) => setSelectedEvent(event)}
              onViewAllEvents={() => setIsEventsOpen(true)}
            />

            {/* 2. 매칭 확정 약속 카드 */}
            <AppointmentReminders appointments={myAppointments} now={now} onOpenDashboard={openAppointment} />

            {/* 3. 어떤 동행을 찾고 계신가요? 12가지 카테고리 그리드 */}
            <CategoryGrid
              categories={mockCategories}
              selectedCategory={selectedCategory?.name || null}
              onSelectCategory={(category) => setSelectedCategory(category)}
            />
          </div>
        )}

        {/* Tab 2: U (주변/둘러보기) */}
        {activeTab === 'explore' && (
          <div className="flex-1 overflow-y-auto">
            <ExploreView
              posts={activeMeetupPosts}
              now={now}
              categories={mockCategories}
              filters={exploreFilters}
              onChangeFilters={setExploreFilters}
              onSelectPost={(post) => setSelectedPostForDetail(post)}
              authorSugarOf={authorSugarOf}
              onGoHome={() => setActiveTab('home')}
            />
          </div>
        )}

        {/* Request and appointment conversations share the same rooms. */}
        {activeTab === 'chat' && <div className="flex-1 flex flex-col">
          {activeRoom && currentUser && activePartner ? <ChatView key={activeRoom.id}
            room={activeRoom} user={currentUser} partner={publicProfileForMember(activePartner, currentUser, users)} post={activeRoomPost} request={activeRoomRequest} appointment={activeRoomAppointment}
            status={roomAccess(activeRoom, currentUser.id, joinRequests, appointments, meetupPosts, clock())}
            completionActions={activeRoomAppointment ? completionActionsFor(activeRoomAppointment) : undefined}
            onBack={() => setActiveRoomId(null)} onOpenProfile={() => setSelectedChatProfile(activePartner)}
            onOpenPost={() => activeRoomPost && setSelectedPostForDetail(activeRoomPost)}
            onOpenDashboard={() => activeRoomAppointment && openAppointment(activeRoomAppointment)}
            onOpenVoiceCall={() => { if(activeRoomAppointment) { setActiveAppointmentId(activeRoomAppointment.id); setIsVoiceCallOpen(true); } }}
            onAccept={() => activeRoomRequest && handleAcceptRequest(activeRoomRequest.id)} onReject={() => activeRoomRequest && handleRejectRequest(activeRoomRequest.id)}
            onCancel={() => activeRoomRequest && openRequestCancellation(activeRoomRequest.id)}
            onCancelAppointment={() => activeRoomAppointment && openAppointmentCancellation(activeRoomAppointment)}
            onReconfirm={(revision, agree, simulate) => activeRoomRequest && handleReconfirm(activeRoomRequest.id, revision, agree, simulate)}
            onSimulatePostChange={() => activeRoomRequest && simulatePostChange(activeRoomRequest.id)}
            onSimulateAccept={() => activeRoomRequest && handleAcceptRequest(activeRoomRequest.id, true)}
            onSend={(text, sample) => sendRoomMessage(activeRoom.id, text, sample)} onDraft={text => updateRoomDraft(activeRoom.id, text)}
            onPropose={proposal => proposeRoomSchedule(activeRoom.id, proposal)} onResolveProposal={(id, accepted, sample) => resolveRoomProposal(activeRoom.id, id, accepted, sample)}
          /> : <ChatListView rooms={chatRooms} user={currentUser} requests={joinRequests} appointments={appointments} posts={meetupPosts} onOpenRoom={id => { const room = chatRooms.find(item => item.id === id); if(room) openRoom(room); }} onOpenAuth={() => setIsAuthModalOpen(true)} />}
        </div>}

        {/* Tab 4: Me */}
        {activeTab === 'me' && (
          <div className="flex-1 overflow-y-auto">
            <MyPageView
              appointments={myAppointments}
              onOpenDashboard={openAppointment}
              requests={joinRequests}
              requestTab={requestTab}
              onChangeRequestTab={setRequestTab}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
              onOpenRequestChat={openRequestRoom}
              onOpenRequestProfile={openRequestProfile}
              onCancelRequest={openRequestCancellation}
              onReconfirmRequest={handleReconfirm}
              posts={meetupPosts}
              onOpenOwnPost={id => setSelectedPostForDetail(meetupPosts.find(post => post.id === id) || null)}
              onOpenRequestPost={(postId) => setSelectedPostForDetail(meetupPosts.find(post => post.id === postId) || null)}
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenKyc={() => setIsKycModalOpen(true)}
              onLogout={handleLogout}
              profileMissing={profileMissing}
              onEditProfile={step => setProfileEditor(profileMissing.length ? { mode: 'setup', step: step || profileMissing[0] } : { mode: 'edit' })}
              onPreviewProfile={() => setIsProfilePreviewOpen(true)}
              reviews={reviews}
              escrowPayments={escrowPayments}
              invitations={invitations}
              userNameOf={id => userById(id)?.maskedName || meetupPosts.find(post => post.authorId === id)?.author || '회원'}
              partnerOf={partnerOf}
              onOpenAppointmentChat={target => { const room = chatRooms.find(item => item.appointmentId === target.id); if (room) openRoom(room); }}
              onOpenPartnerProfile={setSelectedChatProfile}
              onOpenInvitationPost={postId => setSelectedPostForDetail(meetupPosts.find(post => post.id === postId) || null)}
              acceptBlockedReason={acceptBlockedReason}
            />
          </div>
        )}

        {/* Bottom Navigation Bar + FAB (+) Button */}
        <BottomNav
          activeTab={activeTab}
          unreadChatCount={notifications.filter(item => !item.read && item.type === 'chat' && chatRooms.some(room => room.id === item.roomId && room.members.some(member => member.id === currentUser?.id))).length}
          onChangeTab={(tab) => setActiveTab(tab)}
          onOpenCreate={() => handleOpenCreateMeetup()}
        />

        {/* Modal: 참여 대시보드 */}
        <DashboardModal
          appointment={appointment}
          isOpen={isDashboardOpen && Boolean(currentUser && appointment.participantIds?.includes(currentUser.id))}
          onClose={() => setIsDashboardOpen(false)}
          onOpenChat={() => {
            setIsDashboardOpen(false);
            const room = chatRooms.find(item => item.appointmentId === appointment.id);
            if (room) openRoom(room);
            else { setActiveRoomId(null); setActiveTab('chat'); }
          }}
          onOpenSafetyRules={() => setIsSafetyRulesOpen(true)}
          onOpenReport={() => setIsReportOpen(true)}
          onSendArrivalNotice={handleSendArrivalNotice}
          onCancelAppointment={() => openAppointmentCancellation(appointment)}
          partnerProfile={dashboardProfile}
          onOpenPartnerProfile={() => dashboardPartner && setSelectedChatProfile(dashboardPartner)}
          completionActions={completionActionsFor(appointment)}
        />

        {/* Modal: 이벤트 상세 & 불꽃축제 동행 모임 */}
        {isEventsOpen && <EventsView now={now} onClose={() => setIsEventsOpen(false)} onSelectEvent={setSelectedEvent} />}
        <EventDetailModal
          now={now}
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          relatedPosts={activeMeetupPosts.filter((p) => p.eventId && p.eventId === selectedEvent?.id)}
          onSelectPost={setSelectedPostForDetail}
          onCreateForEvent={event => handleOpenCreateMeetup({ eventId: event.id })}
          isCovered={Boolean(selectedPostForDetail) || isCreateModalOpen || isAuthModalOpen || Boolean(profileEditor)}
        />

        {/* Modal: 카테고리별 동행 리스트 */}
        <CategoryDetailModal
          category={selectedCategory}
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          posts={activeMeetupPosts}
          onOpenCreate={() => handleOpenCreateMeetup({ category: selectedCategory?.name })}
          onSelectPost={(post) => setSelectedPostForDetail(post)}
          authorSugarOf={authorSugarOf}
        />

        {/* Modal: 새 동행 모집하기 / 공고 수정하기 (FAB + 클릭 또는 공고 수정 시) */}
        <CreateMeetupModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPost(null);
            setCreateContext(null);
          }}
          onCreateMeetup={handleCreateMeetup}
          onUpdatePost={handleUpdatePost}
          editPost={editingPost}
          currentUser={currentUser}
          now={now}
          variant={demoSettings.variants.postForm}
          showVariantLabel={demoMode}
          initialCategory={createContext?.category}
          linkedEvent={createContext?.eventId ? { id: createContext.eventId, title: createContext.eventTitle || '' } : editingPost?.eventId ? { id: editingPost.eventId, title: eventById(editingPost.eventId)?.title || '' } : null}
        />

        {/* Modal: 공고 상세 및 비밀장소 마스킹 보호 (Phase 2) */}
        <PostDetailModal
          post={selectedPostForDetail}
          isOpen={Boolean(selectedPostForDetail)}
          onClose={() => setSelectedPostForDetail(null)}
          currentUser={currentUser}
          onJoinMeetup={handleStartJoinRequest}
          onOpenEscrow={handleOpenEscrow}
          onEditPost={handleEditPost}
          onClosePost={handleClosePost}
          onDeletePost={handleDeletePost}
          hasLinkedAppointment={appointments.some(item => item.postId === selectedPostForDetail?.id && (isConfirmedAppointment(item) || item.status === '동행 완료'))}
          onOpenExistingChat={existingPostRoom ? () => {
            setSelectedPostForDetail(null); setSelectedCategory(null); setSelectedEvent(null); openRoom(existingPostRoom);
          } : undefined}
          canViewPrivateLocation={canViewSecretLocation(selectedPostForDetail?.id, appointments, currentUser?.id)}
          authorProfile={selectedPostForDetail ? publicProfileForMember(postAuthor(selectedPostForDetail), currentUser, users) : null}
          onOpenAuthorProfile={() => selectedPostForDetail && setSelectedChatProfile(postAuthor(selectedPostForDetail))}
          isCovered={Boolean(selectedChatProfile)}
          now={now}
          eligibility={requestEligibility(selectedPostForDetail || {}, currentUser)}
          linkedEventTitle={detailEvent?.title}
        />

        {/* Phase 3 Modal: 1:1 동행 신청서 모달 (신청자) */}
        <JoinRequestModal
          post={meetupPosts.find(post => post.id === selectedPostForJoin?.id) || null}
          isOpen={isJoinRequestModalOpen}
          onClose={() => {
            setIsJoinRequestModalOpen(false);
            setSelectedPostForJoin(null);
          }}
          currentUser={currentUser}
          appointments={myAppointments}
          onSubmitRequest={handleSendJoinRequest}
        />

        {/* Phase 4 Modal: 안심 안전 5대 수칙 모달 */}
        <SafetyRulesModal
          isOpen={isSafetyRulesOpen}
          onClose={() => setIsSafetyRulesOpen(false)}
        />

        {/* Phase 4 Modal: 1:1 가상 안심 음성 통화 모달 */}
        <VoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => setIsVoiceCallOpen(false)}
          appointment={appointment}
        />

        {/* Phase 4 Modal: 긴급 신고 및 노쇼(No-Show) 센터 모달 */}
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          appointment={appointment}
          onSubmitReport={handleReportSubmit}
        />

        {/* Modal: 알림 창 */}
        <NotificationModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={myNotifications}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onOpenRoom={(roomId) => {
            setIsNotificationsOpen(false);
            if (!currentUser) { setPendingRoomId(roomId); setIsAuthModalOpen(true); return; }
            const room = chatRooms.find(item => item.id === roomId); if (room) openRoom(room);
          }}
          onOpenMatchRequests={(notificationId) => {
            setNotifications((prev) =>
              prev.map((item) => item.id === notificationId ? { ...item, read: true } : item)
            );
            setIsNotificationsOpen(false);
            setRequestTab('received');
            setActiveTab('me');
            if (!currentUser) setIsAuthModalOpen(true);
          }}
        />

        {selectedChatProfile && <UserProfileModal
          key={selectedChatProfile.id}
          profile={publicProfileForMember(selectedChatProfile, currentUser, users)}
          variant={demoSettings.variants.profile}
          showVariantLabel={demoMode}
          onClose={() => setSelectedChatProfile(null)}
          backLabel={selectedPostForDetail ? '공고로 돌아가기' : '이전 화면으로 돌아가기'}
          selfPreview={selectedChatProfile.id === currentUser?.id}
          actions={{
            canInteract: Boolean(currentUser),
            isFavorite: Boolean(currentUser && isSavedBy(currentUser.id, selectedChatProfile.id, favorites)),
            isBlocked: Boolean(currentUser && blocks.some(item => item.blockerId === currentUser.id && item.blockedId === selectedChatProfile.id)),
            onToggleFavorite: () => toggleFavorite(selectedChatProfile.id),
            onReport: () => setSafetyDialog({ kind: 'report', member: selectedChatProfile }),
            onBlock: () => setSafetyDialog({ kind: 'block', member: selectedChatProfile }),
            onLoginRequired: () => { setSelectedChatProfile(null); setIsAuthModalOpen(true); },
          }}
        />}
        {isProfilePreviewOpen && currentUser && <UserProfileModal profile={publicProfileForMember(selfMember(currentUser), currentUser, users)}
          variant={demoSettings.variants.profile} showVariantLabel={demoMode} selfPreview backLabel="Me로 돌아가기" onClose={() => setIsProfilePreviewOpen(false)} />}
        {profileEditor && currentUser && <ProfileEditor
          key={`${currentUser.id}-${profileEditor.mode}`}
          user={currentUser} mode={profileEditor.mode} initialStep={profileEditor.step} reason={profileEditor.reason}
          variant={demoSettings.variants.profile} showVariantLabel={demoMode}
          previewOf={patch => publicProfileForMember(selfMember(currentUser), { ...currentUser, ...patch }, users)}
          onCommit={commitProfile}
          onClose={() => setProfileEditor(null)}
          onDone={() => { setProfileEditor(null); setLifecycleNotice(profileEditor.mode === 'setup' ? '프로필을 저장했어요. 이제 동행을 신청하거나 공고를 올릴 수 있어요.' : '프로필 변경을 저장했어요.'); }}
        />}
        {safetyDialog?.kind === 'report' && <ReportUserDialog targetName={safetyDialog.member.displayName} onClose={() => setSafetyDialog(null)}
          onSubmit={() => { setSafetyDialog(null); setLifecycleNotice('신고를 예시로 접수했어요. 실제 운영팀 전달이나 자동 제재는 없어요.'); }} />}
        {safetyDialog?.kind === 'block' && <BlockUserDialog targetName={safetyDialog.member.displayName}
          affectedTitles={activeAppointmentsWith(safetyDialog.member.id).map(item => item.title)}
          onClose={() => setSafetyDialog(null)} onConfirm={() => confirmBlock(safetyDialog.member)} />}
        {postAction && <LifecycleConfirmDialog title={postAction.mode === 'deleted' ? '공고 삭제' : '모집 마감'} description={postAction.mode === 'deleted' ? '공고를 목록에서 지우고 남아 있는 신청을 종료합니다. 기존 신청·대화 기록은 보존돼요.' : '새 신청을 받지 않고 미확정 신청을 함께 종료합니다. 동행이 확정되는 것은 아니에요.'} actionLabel={postAction.mode === 'deleted' ? '공고 삭제하기' : '모집 마감하기'} onClose={() => setPostAction(null)} onConfirm={confirmPostAction} />}
        {cancellationTarget && <CancellationDialog key={cancellationTarget.id} kind={cancellationTarget.kind} title={cancellationTarget.title} onClose={() => setCancellationTarget(null)} onConfirm={confirmCancellation} />}
        {conflictPrompt && <ScheduleConflictDialog conflicts={conflictPrompt.conflicts} onClose={() => setConflictPrompt(null)} onContinue={continueConflict} />}
        {lifecycleNotice && <div role="alert" className="fixed bottom-24 left-5 right-5 mx-auto max-w-sm bg-gray-900 text-white p-4 rounded-2xl z-[95] text-xs leading-relaxed shadow-lg">{lifecycleNotice}<button onClick={() => setLifecycleNotice(null)} className="block ml-auto mt-2 font-bold underline">안내 닫기</button></div>}
        {/* Modal: 회원가입 / 휴대폰 본인확인 (Phase 1) */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
          users={users}
          now={now}
        />

        {/* Modal: 선택형 KYC 본인확인 (Phase 1) */}
        <KycAuthModal
          isOpen={isKycModalOpen}
          onClose={() => setIsKycModalOpen(false)}
          isAlreadyVerified={currentUser?.isKycVerified || false}
        />

        {/* Phase 5 Modal: 상호 블라인드 평가 및 실시간 당도 정산 모달 */}
        {isReviewModalOpen && <ReviewModal
          key={reviewAppointment.id}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          appointment={reviewAppointment}
          existingSubmission={submittedReviews[reviewKey(reviewAppointment.id)]}
          hasSettled={settlementLocks.current.has(reviewKey(reviewAppointment.id))}
          onSubmitReview={handleSubmitReview}
          onSettleSugar={handleSettleSugar}
        />}

        {/* Phase 6 Modal: PRO 1:1 안심 에스크로 결제 모달 */}
        <EscrowPaymentModal
          isOpen={isEscrowModalOpen}
          onClose={() => {
            setIsEscrowModalOpen(false);
            setSelectedProPostForEscrow(null);
          }}
          post={selectedProPostForEscrow}
        />
      </main>
    </div>
  );
}
