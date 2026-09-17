/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppRoute } from './auth/useAppRoute';
import { isProtectedPath, loginPath, safeReturnPath } from './auth/routes';
import { AuthGate } from './components/AuthGate';
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
import { formatMeetupRange, isValidMeetupRange } from './utils/meetupLifecycle';
import { completionReviewState, createAppointmentReview, createCompletionConfirmation, releasedReviewsFor, type ReviewDraft } from './utils/reviews';
import { CategoryGrid } from './components/CategoryGrid';
import { BottomNav, NavTab } from './components/BottomNav';
import { DashboardModal } from './components/DashboardModal';
import { EventDetailModal } from './components/EventDetailModal';
import { CategoryDetailModal } from './components/CategoryDetailModal';
import { CreateMeetupModal } from './components/CreateMeetupModal';

import { NotificationModal } from './components/NotificationModal';
import { AuthModal } from './components/AuthModal';
import { DemoAuthModal } from './components/DemoAuthModal';
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
import { isSavedBy, notificationSettingsFor } from './utils/relations';
import { canInviteToPost, invitationStatusForPost, shouldNotifyInvitation } from './utils/invitations';
import { publicProfileForMember, publicProfileForPost } from './data/publicProfiles';
import { CancellationDialog, LifecycleConfirmDialog, ScheduleConflictDialog } from './components/LifecycleDialogs';
import { cancelAppointment as cancelConfirmedAppointment, closePost, conditionsOf, confirmChangedConditions, expirePosts, isConfirmedAppointment, isOpenRequest, isRecruiting, overlappingAppointments, recruitmentDeadline, updateRecruitingPost, type LifecycleState } from './utils/postLifecycle';
import { acceptRequest, createRequestRoom, requestRoomId, roomAccess } from './utils/conversations';
import { MyPageView } from './components/MyPageView';
import { DemoControlPanel } from './components/DemoControlPanel';
import { createSeedData } from './data/prototypeSeed';
import { demoNow, isDemoMode } from './utils/demoMode';
import { browserStorage, clearPrototype, loadPrototype, savePrototype, storageIssueMessage, STORAGE_KEYS, type PrototypeData, type StorageIssue } from './utils/prototypeStore';
import { canViewSecretLocation, visibleNotifications } from './utils/access';
import { blockImpact } from './utils/blocking';
import { useSupabaseAuth } from './auth/useSupabaseAuth';
import { currentUserFromProfile } from './auth/user';
import { getSupabaseClient } from './lib/supabase';
import { useLiveBackend } from './live/useLiveBackend';
import { NEW_USER_SUGAR_POLICY } from './live/adapters';

import { mockCategories } from './data/mockData';
import { Appointment, AppointmentReview, BlockRelation, CategoryItem, ChatMember, CompletionConfirmation, DemoSettings, EventBannerItem, FavoriteFriend, Invitation, MeetupPost, CurrentUser, JoinRequest, ReviewItem, EscrowPayment, NotificationItem, NotificationSettings, ChatRoom, ScheduleProposal } from './types';

const NAV_TABS: NavTab[] = ['home', 'explore', 'chat', 'me'];

// Product analytics will be reintroduced after the new backend contract is defined.
const trackBackEvent = (_event: Record<string, unknown>) => {};
const trackFunnelEvent = (_event: Record<string, unknown>) => {};

/** Normal runs start empty and are filled from Supabase; no sample posts, chats or notifications. */
const emptyServiceData = (): PrototypeData => ({
  ...createSeedData(), posts: [], requests: [], rooms: [], appointments: [], notifications: [], reviews: [],
  favorites: [], invitations: [], completions: [], appointmentReviews: [], notificationSettings: [], blocks: [], users: [], activeUserId: null,
});

/** Shown for existing screens whose backend is not built yet. Nothing is saved or faked. */
const NOT_READY_NOTICE = '이 기능은 아직 준비 중이에요. 지금은 저장되지 않아요.';

type ConflictAction =
  | { kind: 'join'; postId: string; message: string }
  | { kind: 'accept'; requestId: string; simulateHost: boolean }
  | { kind: 'proposal'; roomId: string; messageId: string; accepted: boolean; sample: boolean }
  | { kind: 'create'; post: MeetupPost };

export default function App() {
  // `?demo=1` is fixed for the page lifetime and uses its own storage key.
  const [demoMode] = useState(isDemoMode);
  const supabaseAuth = useSupabaseAuth(!demoMode);
  const storageKey = demoMode ? STORAGE_KEYS.demo : STORAGE_KEYS.app;
  const [boot] = useState(() => {
    // Normal runs show Supabase data only; the browser sample store belongs to `?demo=1`.
    if (!demoMode) return { data: emptyServiceData(), issue: undefined };
    const loaded = loadPrototype(browserStorage(), storageKey);
    return { data: loaded.data || createSeedData(), issue: loaded.issue };
  });
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(boot.issue || null);
  // Unreadable saved data is kept untouched until the user retries or resets.
  const [autosave, setAutosave] = useState(demoMode && boot.issue !== 'corrupt' && boot.issue !== 'version');

  // Navigation state
  const { path, search, activeTab, setActiveTab, navigate } = useAppRoute();
  useEffect(() => {
    if (demoMode && path === '/' && NAV_TABS.includes(boot.data.ui.activeTab as NavTab)) setActiveTab(boot.data.ui.activeTab as NavTab);
  }, []);

  // Prototype authentication and data live only in this browser.
  const [users, setUsers] = useState<CurrentUser[]>(boot.data.users);
  const [localUser, setCurrentUser] = useState<CurrentUser | null>(() =>
    boot.data.users.find(user => user.id === boot.data.activeUserId) || null);
  const currentUser = demoMode
    ? localUser
    : supabaseAuth.user && supabaseAuth.profile
      ? currentUserFromProfile(supabaseAuth.user, supabaseAuth.profile)
      : null;
  const privateAreaAllowed = demoMode
    ? Boolean(currentUser?.isLoggedIn)
    : supabaseAuth.status === 'authenticated';
  // Normal runs: every post, request, chat, appointment, completion and review comes from Supabase.
  const live = useLiveBackend(!demoMode, !demoMode && privateAreaAllowed && currentUser ? currentUser.id : null,
    !demoMode && currentUser ? { id: currentUser.id, displayName: currentUser.maskedName, avatar: avatarSrc(currentUser.avatar) } : null);
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
    if (!demoMode) return;
    if (currentUser) setUsers(prev => prev.some(user => user.id === currentUser.id)
      ? prev.map(user => user.id === currentUser.id ? currentUser : user)
      : [...prev, currentUser]);
  }, [demoMode, currentUser]);

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

  // UI 뒤로가기/닫기 이벤트 및 체류시간 추적
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
  const previousIdentity = useRef<string | null>(null);
  const prototypeSignInSucceeded = useRef(false);
  useEffect(() => {
    const identity = currentUser?.id || null;
    if (!previousIdentity.current) { previousIdentity.current = identity; return; }
    if (previousIdentity.current !== identity) {
      setActiveRoomId(null); setPendingRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false);
      setSelectedChatProfile(null); setProfileEditor(null); setIsProfilePreviewOpen(false); setSafetyDialog(null);
      setIsJoinRequestModalOpen(false); setIsCreateModalOpen(false); setEditingPost(null); setCreateContext(null);
      setIsNotificationsOpen(false); setIsVoiceCallOpen(false); setIsReportOpen(false); setIsEscrowModalOpen(false);
      setIsKycModalOpen(false); setPostAction(null); setCancellationTarget(null); setConflictPrompt(null);

      previousIdentity.current = identity;
    }
  }, [currentUser?.id]);
  useEffect(() => {
    if (demoMode) return;
    const status = supabaseAuth.status;
    if (isProtectedPath(path) && ['anonymous', 'profile-incomplete', 'error'].includes(status)) navigate(loginPath(path), true);
    if (path === '/login') {
      if (status === 'authenticated') {
        setIsAuthModalOpen(false);
        navigate(safeReturnPath(search.get('next')), true);
      } else if (status === 'anonymous' || status === 'profile-incomplete') setIsAuthModalOpen(true);
      else setIsAuthModalOpen(false);
    } else if (status === 'authenticated') setIsAuthModalOpen(false);
    if (status === 'profile-incomplete') setIsAuthModalOpen(true);
  }, [path, demoMode, supabaseAuth.status]);
  const closeAuth = () => {
    setIsAuthModalOpen(false);
    if (!demoMode && path === '/login') navigate('/', true);
    prototypeSignInSucceeded.current = false;
  };
  const accessOf = (room: ChatRoom) => {
    if (demoMode) return roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock());
    const base = roomAccess(room, currentUser?.id, joinRequests, appointments, meetupPosts, clock());
    const request = joinRequests.find(item => item.id === room.requestId);
    const post = meetupPosts.find(item => item.id === room.postId);
    if (!base.canView || !request || request.status !== 'pending' || !post || post.status === 'deleted') return base;
    return Date.parse(post.startsAt || '') > clock().getTime() ? { canView: true, canSend: true, label: '매칭 중 · 확정 전' } : base;
  };
  // The chat room height subtracts this banner; a fixed 0px pushed the message input under the bottom tab bar.
  const serviceBannerRef = useRef<HTMLDivElement>(null);
  const [serviceBannerHeight, setServiceBannerHeight] = useState(0);
  useEffect(() => {
    const banner = serviceBannerRef.current;
    if (!banner) return;
    const update = () => setServiceBannerHeight(Math.ceil(banner.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(banner);
    return () => observer.disconnect();
  }, []);
  const matchingLocks = useRef(new Set<string>());
  const proposalLocks = useRef(new Set<string>());
  const activeRoom = chatRooms.find(room => room.id === activeRoomId && room.members.some(member => member.id === currentUser?.id));
  const activeRoomRequest = joinRequests.find(request => request.id === activeRoom?.requestId);
  const activeRoomPost = meetupPosts.find(post => post.id === activeRoom?.postId);
  const activeRoomAppointment = appointments.find(item => item.id === activeRoom?.appointmentId);
  const activePartner = activeRoom?.members.find(member => member.id !== currentUser?.id);
  const myAppointments = appointments.filter(item => currentUser && item.participantIds?.includes(currentUser.id));
  const openRoom = (room: ChatRoom) => {

    if (!accessOf(room).canView) return;
    setActiveRoomId(room.id);
    if (room.appointmentId) setActiveAppointmentId(room.appointmentId);
    setActiveTab('chat');
    setNotifications(prev => prev.map(item => item.roomId === room.id && item.recipientId === currentUser?.id ? { ...item, read: true } : item));
  };
  const openRequestRoom = (id: string) => {
    const room = chatRooms.find(room => room.requestId === id);
    if (room) openRoom(room);
  };
  const openRequestProfile = (id: string) => {
    const room = chatRooms.find(room => room.requestId === id);
    if (!room || !accessOf(room).canView) return;
    const member = room.members.find(member => member.id !== currentUser?.id);
    if (member) setSelectedChatProfile(member);
  };
  const updateRoomDraft = (id: string, draft: string) => setChatRooms(prev => prev.map(room => room.id === id && room.members.some(member => member.id === currentUser?.id) ? { ...room, draft } : room));
  const sendRoomMessage = (id: string, text: string, sample = false) => {

    const room = chatRooms.find(room => room.id === id);
    if (!room || !text.trim() || !accessOf(room).canSend || (sample && currentUser?.id !== DEMO_USER_ID)) return;
    if (!demoMode) {
      if (sample || !room.requestId) return;
      setChatRooms(prev => prev.map(item => item.id === id ? { ...item, draft: '' } : item));
      void live.actions.sendMessage(room.requestId, text.trim()).then(result => {
        if ('error' in result) { setLifecycleNotice(result.error); setChatRooms(prev => prev.map(item => item.id === id ? { ...item, draft: text } : item)); }
      });
      return;
    }
    const senderId = sample ? room.members.find(member => member.id !== currentUser!.id)!.id : currentUser!.id;
    const message = { id: crypto.randomUUID(), senderId, text: text.trim(), createdAt: new Date().toISOString(), isSample: sample };
    setChatRooms(prev => prev.map(item => item.id === id ? { ...item, draft: sample ? item.draft : '', messages: [...item.messages, message] } : item));
    const recipientId = room.members.find(member => member.id !== senderId)?.id;
    if (recipientId) setNotifications(prev => [{ id: `notif-${message.id}`, title: sample ? '새 동행 메시지 · 시연' : '새 동행 메시지', description: text, roomId: id, recipientId, createdAt: clock().toISOString(), targetType: 'room', targetId: id, type: 'chat', time: '방금', read: false }, ...prev]);
  };
  const proposeRoomSchedule = (id: string, proposal: ScheduleProposal) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    const room = chatRooms.find(room => room.id === id);
    const target = appointments.find(item => item.id === room?.appointmentId);
    if (!room || !target || target.status === '동행 완료' || !accessOf(room).canSend || !isValidMeetupRange(proposal.startsAt, proposal.endsAt)) return;
    if (room.messages.some(item => item.proposal?.status === 'pending')) { alert('먼저 보낸 일정 변경 제안의 응답을 기다려 주세요.'); return; }
    setChatRooms(prev => prev.map(item => item.id === id ? { ...item, messages: [...item.messages, { id: crypto.randomUUID(), senderId: currentUser!.id, text: '일정·장소 변경을 제안했어요.', createdAt: new Date().toISOString(), proposal }] } : item));
  };
  const resolveRoomProposal = (roomId: string, messageId: string, accepted: boolean, sample = false, ignoreConflict = false) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    const room = chatRooms.find(item => item.id === roomId);
    const message = room?.messages.find(item => item.id === messageId);
    const proposal = message?.proposal;
    const target = appointments.find(item => item.id === room?.appointmentId);
    if (!room || !target || target.status === '동행 완료' || !proposal || proposal.status !== 'pending' || proposalLocks.current.has(messageId) || !accessOf(room).canSend) return;
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
  useEffect(() => {
    if (demoMode) return;
    const ids = [selectedChatProfile?.id, selectedPostForDetail?.authorId, ...chatRooms.flatMap(room => room.members.map(member => member.id))];
    ids.forEach(id => { if (id) void live.ensureProfile(id); });
  }, [demoMode, selectedChatProfile?.id, selectedPostForDetail?.authorId, chatRooms, live.ensureProfile]);

  useEffect(() => {
    if (demoMode) return;
    setMeetupPosts(live.data.posts); setJoinRequests(live.data.requests); setAppointments(live.data.appointments);
    setCompletions(live.data.completions); setAppointmentReviews(live.data.appointmentReviews);
    // Server refreshes must not wipe a message the member is still typing.
    setChatRooms(previous => live.data.rooms.map(room => ({ ...room, draft: previous.find(item => item.id === room.id)?.draft || '' })));
  }, [demoMode, live.data]);
  useEffect(() => {
    if (!demoMode && live.status === 'error' && live.error) setLifecycleNotice(`Supabase 데이터를 불러오지 못했어요. ${live.error}`);
  }, [demoMode, live.status, live.error]);

  const privateDataReady = privateAreaAllowed;

  // Save every shared record under the versioned key (tab changes, reloads, window close).
  const snapshot = (): PrototypeData => ({
    posts: meetupPosts, requests: joinRequests, rooms: chatRooms, appointments, notifications, reviews,
    favorites, invitations, completions, appointmentReviews, notificationSettings, blocks,
    // Supabase identity/profile data is not duplicated into the prototype localStorage envelope.
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
    setCurrentUser(data.users.find(user => user.id === (keepUserId || data.activeUserId)) || null);
    setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
    setSelectedPostForDetail(null); setIsNotificationsOpen(false); matchingLocks.current.clear(); proposalLocks.current.clear();
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
    if (!demoMode) return;
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
  useEffect(() => {

    setInvitations(previous => {
      let changed = false;
      const next = previous.map(item => {
        const status = invitationStatusForPost(item, meetupPosts.find(post => post.id === item.postId));
        if (status === item.status) return item;
        changed = true;
        return { ...item, status };
      });
      return changed ? next : previous;
    });
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

    setNotifications((prev) => prev.map((n) => n.recipientId === currentUser?.id ? { ...n, read: true } : n));
  };

  const profileMissing = demoMode && currentUser ? missingProfileSteps(currentUser) : [];
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

  const handleCreateMeetup = (newPost: MeetupPost, ignoreConflict = false): boolean | Promise<boolean> => {

    if (!currentUser || newPost.authorId !== currentUser.id || !isRecruiting(newPost, clock())) return false;
    if (!ignoreConflict && warnConflict({ kind: 'create', post: newPost }, [currentUser.id], newPost.startsAt, newPost.endsAt)) return false;
    if (!demoMode) return (async () => {
      const result = await live.actions.createPost({
        p_post_id: newPost.id.replace(/^post-/, ''), p_title: newPost.title, p_description: newPost.description || '', p_category: newPost.category,
        p_starts_at: newPost.startsAt, p_ends_at: newPost.endsAt, p_recruitment_ends_at: newPost.recruitmentEndsAt || newPost.startsAt,
        p_public_area: newPost.location, p_exact_location: newPost.secretLocation || '', p_preference_note: newPost.partnerPreferences || null,
        p_tags: newPost.tags, p_partner_gender: newPost.partnerGender || 'any',
      });
      if ('error' in result) { setLifecycleNotice(result.error); return false; }
      setIsCreateModalOpen(false); setCreateContext(null);
      return true;
    })();
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
      ...prev.filter(item => !(item.type === 'new_post' && item.targetId === newPost.id)),
    ]);
    const interested = favorites.filter(item => item.targetId === currentUser.id && item.notifyNewPosts).map(item => item.ownerId);
    if (interested.length) setNotifications(prev => [
      ...interested.map(recipientId => ({
        id: `notif-new-post-${newPost.id}-${recipientId}`, recipientId, createdAt: clock().toISOString(),
        title: `${currentUser.maskedName}님이 새 공고를 올렸어요`, description: newPost.title, time: '방금', read: false,
        type: 'new_post' as const, targetType: 'post' as const, targetId: newPost.id,
      })),
      ...prev,
    ]);
    setIsCreateModalOpen(false); setCreateContext(null);
    return true;
  };

  const handleUpdatePost = (updatedPost: MeetupPost) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return false; }

    if (!applyLifecycle(updateRecruitingPost(lifecycleState(), updatedPost, currentUser?.id, clock()))) return false;
    setSelectedPostForDetail(updatedPost); setEditingPost(null);
    return true;
  };
  const handleClosePost = (postId: string) => demoMode ? setPostAction({ id: postId, mode: 'closed' }) : setLifecycleNotice(NOT_READY_NOTICE);
  const handleDeletePost = (postId: string) => demoMode ? setPostAction({ id: postId, mode: 'deleted' }) : setLifecycleNotice(NOT_READY_NOTICE);
  const confirmPostAction = () => {

    if (!postAction) return;
    const succeeded = applyLifecycle(closePost(lifecycleState(), postAction.id, postAction.mode, currentUser?.id, clock()));
    if (succeeded) setLifecycleNotice(postAction.mode === 'deleted' ? '공고를 삭제했어요. 이전 신청과 대화 기록은 남아 있어요.' : '모집을 마감했어요. 미확정 신청도 함께 종료됐어요.');
    setPostAction(null);
  };
  const handleEditPost = (post: MeetupPost) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }
    if (post.authorId !== currentUser?.id || !isRecruiting(post, clock())) { setLifecycleNotice('모집 중인 본인 공고만 수정할 수 있어요. 확정 약속은 대화방에서 변경을 제안해 주세요.'); return; }
    setEditingPost(post); setCreateContext(null); setSelectedPostForDetail(null); setIsCreateModalOpen(true);
  };
  const userById = (id: string) => users.find(user => user.id === id) || (currentUser?.id === id ? currentUser : undefined);
  /** Host-side reason an open request cannot be accepted: the requester no longer meets the partner condition. */
  const acceptBlockedReason = (request: JoinRequest) => {
    if (!demoMode) return null; // the server checks the partner condition when the request is created
    const post = meetupPosts.find(item => item.id === request.postId);
    const requester = userById(request.requesterId);
    return post && requester && !requestEligibility(post, requester).ok ? '신청자가 현재 상대 조건에 맞지 않아 수락할 수 없어요. 조건을 되돌리거나 신청을 거절해 주세요.' : null;
  };
  const handleReconfirm = (requestId: string, revision: number, agree: boolean, simulate = false) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

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
    if (!demoMode) return;
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
  const handleSendJoinRequest = (postId: string, message: string, ignoreConflict = false): boolean | Promise<boolean> => {
    if (!demoMode) {
      const target = activeMeetupPosts.find(item => item.id === postId);
      if (!target || !currentUser) return false;
      if (!ignoreConflict && warnConflict({ kind: 'join', postId, message }, [currentUser.id], target.startsAt, target.endsAt)) return false;
      return (async () => {
        const result = await live.actions.createRequest(postId, message);
        if ('error' in result) { setLifecycleNotice(result.error); return false; }
        setIsJoinRequestModalOpen(false); setSelectedPostForJoin(null);
        setActiveRoomId(`room-${result.requestId}`); setActiveTab('chat');
        return true;
      })();
    }

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
        time: '방금', createdAt: clock().toISOString(), recipientId: currentUser.id, targetType: 'room', targetId: room.id,
        read: false,
        type: 'matching',
      },
      {
        id: `notif-request-${newReq.id}`, title: `${currentUser.maskedName}님이 동행을 신청했어요`,
        description: `"${post.title}" 신청 내용을 확인하세요. 대화 없이 바로 수락할 수도 있어요.`,
        time: '방금', createdAt: clock().toISOString(), recipientId: post.authorId,
        read: false, type: 'matching', action: 'match_requests', targetType: 'room', targetId: room.id, roomId: room.id,
      },
      ...prev,
    ]);
    setInvitations(prev => prev.map(item => item.postId === post.id && item.recipientId === currentUser.id && item.senderId === post.authorId ? { ...item, status: 'applied' } : item));

    setIsJoinRequestModalOpen(false); setSelectedPostForJoin(null);
    return true;
  };

  // A request enables conversation; only the host's final acceptance confirms a match.
  const handleAcceptRequest = (requestId: string, simulateHost = false, ignoreConflict = false) => {

    const targetReq = joinRequests.find(item => item.id === requestId);
    if (!targetReq || !currentUser) return;
    if (!demoMode) {
      if (simulateHost || targetReq.hostId !== currentUser.id) return;
      const targetPost = meetupPosts.find(item => item.id === targetReq.postId);
      if (!ignoreConflict && warnConflict({ kind: 'accept', requestId, simulateHost }, [targetReq.hostId, targetReq.requesterId], targetPost?.startsAt, targetPost?.endsAt)) return;
      if (matchingLocks.current.has(targetReq.postId)) return;
      matchingLocks.current.add(targetReq.postId);
      void live.actions.confirmMatch(requestId).then(result => {
        matchingLocks.current.delete(targetReq.postId);
        if ('error' in result) { setLifecycleNotice(result.error); return; }
        setActiveRoomId(requestRoomId(requestId)); setActiveTab('chat');
      });
      return;
    }
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
    setNotifications(prev => [{ id: `notif-${crypto.randomUUID()}`, title: '동행 매칭 확정', description: targetPost.title, roomId, recipientId: targetReq.requesterId, createdAt: clock().toISOString(), targetType: 'appointment', targetId: appointmentId, type: 'matching', time: '방금', read: false }, ...prev]);
    trackFunnelEvent({ step: 'MATCH_ACCEPT', targetPostId: targetPost.id, pageKey: 'MATCH_REQUESTS', metadata: { requesterId: targetReq.requesterId, simulated: simulateHost } });
    setActiveRoomId(roomId); setActiveTab('chat');
  };
  const endRequest = (requestId: string, status: 'rejected' | 'cancelled', reason = '') => {

    const request = joinRequests.find(item => item.id === requestId);
    if (!request || !isOpenRequest(request) || (status === 'rejected' ? request.hostId : request.requesterId) !== currentUser?.id) return false;
    if (!demoMode) {
      // The cancellation reason is not stored yet; only the status change is saved.
      void (status === 'rejected' ? live.actions.decline(requestId) : live.actions.withdraw(requestId))
        .then(result => { if ('error' in result) setLifecycleNotice(result.error); });
      return true;
    }
    const text = status === 'rejected' ? '작성자가 신청을 거절했어요.' : `신청자가 동행 신청을 취소했어요. 사유: ${reason}`;
    setJoinRequests(prev => prev.map(item => item.id === requestId && isOpenRequest(item) ? { ...item, status, cancellationReason: reason } : item));
    setChatRooms(prev => prev.map(room => room.requestId === requestId ? { ...room, messages: [...room.messages, { id: crypto.randomUUID(), senderId: 'system', text, createdAt: new Date().toISOString() }] } : room));
    const recipientId = status === 'rejected' ? request.requesterId : request.hostId;
    setNotifications(prev => [{ id: crypto.randomUUID(), title: status === 'rejected' ? '신청 거절' : '신청 취소', description: text, roomId: requestRoomId(requestId), recipientId, createdAt: clock().toISOString(), targetType: 'room', targetId: requestRoomId(requestId), type: 'matching', time: '방금', read: false }, ...prev]);
    return true;
  };
  const handleRejectRequest = (id: string) => endRequest(id, 'rejected');
  const openRequestCancellation = (id: string) => {
    const request = joinRequests.find(item => item.id === id);
    if (request && isOpenRequest(request) && request.requesterId === currentUser?.id) setCancellationTarget({ id, kind: 'request', title: request.postTitle });
  };
  const openAppointmentCancellation = (target: Appointment) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }
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
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

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
        description: `${appointment.partnerName} 회원에 대한 예시 접수 상태를 만들었어요. 실제 운영팀·기관에 전달되지 않았고 자동 제재나 당도 감점도 없어요.`,
        time: '방금',
        createdAt: clock().toISOString(),
        recipientId: currentUser?.id,
        read: false,
        type: 'matching',
      },
      ...prev,
    ]);
  };

  // Phase 4: Send 10-minute Arrival Notice
  const handleSendArrivalNotice = () => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

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

  // Phase 5: personal completion + mutual blind reviews
  const handleOpenReview = (target: Appointment) => {
    const state = completionReviewState(target, currentUser?.id, completions, appointmentReviews, clock());
    if (!state.canReview && !state.hasOwnReview && !state.reviewsReleased) return;
    setReviewAppointmentId(target.id);
    setIsReviewModalOpen(true);
  };

  const handleCompleteAppointment = (target: Appointment) => {
    if (!currentUser) return;
    if (!demoMode) {
      void live.actions.confirmCompletion(target.id).then(result => {
        if ('error' in result) { setLifecycleNotice(result.error); return; }
        setReviewAppointmentId(target.id); setIsReviewModalOpen(true);
      });
      return;
    }
    const result = createCompletionConfirmation(target, currentUser.id, completions, appointmentReviews, clock());
    if ('error' in result) { setLifecycleNotice(result.error); return; }
    const nextCompletions = [...completions, result.value];
    setCompletions(nextCompletions);
    const partnerId = target.participantIds?.find(id => id !== currentUser.id);
    setAppointments(prev => prev.map(item => item.id === target.id ? { ...item, status: '동행 완료', dDay: '완료됨' } : item));
    if (partnerId) setNotifications(prev => [{
      id: `notif-completion-${target.id}-${currentUser.id}`, recipientId: partnerId, createdAt: result.value.confirmedAt,
      title: `${currentUser.maskedName}님이 동행 완료를 확인했어요`, description: '평가 내용은 포함되지 않아요. 내 완료 확인 후 평가를 남길 수 있어요.',
      time: '방금', read: false, type: 'completion', targetType: 'appointment', targetId: target.id,
    }, ...prev]);
    setReviewAppointmentId(target.id);
    setIsReviewModalOpen(true);
  };

  const handleDisputeAppointment = (target: Appointment) => {
    if (!currentUser) return;
    if (demoMode) { setLifecycleNotice('완료 이의 제기는 실제 서버 정책에서만 처리돼요.'); return; }
    if (!window.confirm('완료 처리에 이의를 제기할까요? 검토가 끝날 때까지 평가 작성과 공개가 멈춥니다.')) return;
    void live.actions.raiseDispute(target.id, '동행 완료 처리에 이의를 제기합니다.').then(result => {
      setLifecycleNotice('error' in result ? result.error : '이의가 접수됐어요. 검토가 끝날 때까지 평가 작성과 공개가 멈춥니다.');
    });
  };

  const handleSubmitReview = async (reviewPayload: ReviewDraft): Promise<{ ok: true } | { ok: false; error: string }> => {

    if (!currentUser) return { ok: false, error: '로그인 후 평가해 주세요.' };
    if (!demoMode) return live.actions.submitReview(reviewAppointment.id, reviewPayload.rating, reviewPayload.comment);
    const result = createAppointmentReview(reviewAppointment, currentUser.id, reviewPayload, completions, appointmentReviews, demoSettings.variants.review, clock());
    if ('error' in result) return result;
    const partnerId = result.value.revieweeId;
    const partnerAlreadySubmitted = appointmentReviews.some(item => item.appointmentId === reviewAppointment.id && item.reviewerId === partnerId);
    setAppointmentReviews(prev => [...prev, result.value]);
    const createdAt = result.value.submittedAt;
    setNotifications(prev => [
      { id: `notif-review-self-${reviewAppointment.id}-${currentUser.id}`, recipientId: currentUser.id, createdAt, title: '블라인드 평가 제출 완료', description: partnerAlreadySubmitted ? '양쪽 평가가 모두 제출되어 공개 조건을 확인하고 있어요.' : '상대가 제출하면 함께, 한쪽만 제출하면 7일 기한에 공개돼요.', time: '방금', read: false, type: 'review', targetType: 'review', targetId: reviewAppointment.id },
      ...(partnerAlreadySubmitted ? [{ id: `notif-review-release-${reviewAppointment.id}-${partnerId}`, recipientId: partnerId, createdAt, title: '상호 평가가 공개됐어요', description: '양쪽 평가가 모두 제출되어 서로의 후기를 확인할 수 있어요.', time: '방금', read: false, type: 'review' as const, targetType: 'review' as const, targetId: reviewAppointment.id }] : []),
      ...prev,
    ]);
    return { ok: true };
  };

  const handleAuthSuccess = (authenticated: CurrentUser, kind: 'signup' | 'signin' = 'signin') => {
    prototypeSignInSucceeded.current = true;
    // Existing accounts keep their saved profile edits.
    const stored = users.find(user => user.id === authenticated.id);
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

  const commitProfile = (patch: ProfilePatch) => {  if (currentUser) setCurrentUser({ ...currentUser, ...patch }); };
  const selfMember = (user: CurrentUser): ChatMember => ({ id: user.id, displayName: user.maskedName, avatar: user.avatar });
  const toggleFavorite = (targetId: string) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    if (!currentUser || targetId === currentUser.id || blocks.some(item => item.blockerId === currentUser.id && item.blockedId === targetId)) return;
    // Private one-way save: no notification is created for the target.
    setFavorites(prev => isSavedBy(currentUser.id, targetId, prev)
      ? prev.filter(item => !(item.ownerId === currentUser.id && item.targetId === targetId))
      : [...prev, { ownerId: currentUser.id, targetId, savedAt: clock().toISOString(), notifyNewPosts: true }]);
  };
  const toggleFavoriteNotice = (targetId: string) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    if (!currentUser) return;
    setFavorites(prev => prev.map(item => item.ownerId === currentUser.id && item.targetId === targetId ? { ...item, notifyNewPosts: !item.notifyNewPosts } : item));
  };
  const openProfileById = (targetId: string) => {
    const user = userById(targetId);
    const post = meetupPosts.find(item => item.authorId === targetId);
    if (user) setSelectedChatProfile(selfMember(user));
    else if (post) setSelectedChatProfile(postAuthor(post));
  };
  const inviteFavorite = (targetId: string, postId: string) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    if (!currentUser || !isSavedBy(currentUser.id, targetId, favorites)) return;
    const post = meetupPosts.find(item => item.id === postId);
    const blocked = blocks.some(item => (item.blockerId === currentUser.id && item.blockedId === targetId) || (item.blockerId === targetId && item.blockedId === currentUser.id));
    const allowed = canInviteToPost(post, currentUser.id, targetId, invitations, blocked, clock());
    if (!allowed.ok) { setLifecycleNotice(allowed.reason); return; }
    const invitation: Invitation = { id: `invite-${crypto.randomUUID()}`, postId, senderId: currentUser.id, recipientId: targetId, receivedAt: clock().toISOString(), status: 'received' };
    setInvitations(prev => [invitation, ...prev]);
    if (shouldNotifyInvitation(invitation, notificationSettings, favorites, appointments, completions)) setNotifications(prev => [{
      id: `notif-${invitation.id}`, recipientId: targetId, createdAt: invitation.receivedAt, title: `${currentUser.maskedName}님이 동행에 초대했어요`,
      description: post!.title, time: '방금', read: false, type: 'invitation', targetType: 'invitation', targetId: invitation.id,
    }, ...prev]);
    setLifecycleNotice('공개된 공고로 초대했어요. 상대가 직접 신청하고 작성자가 수락해야 확정됩니다.');
  };
  const openInvitation = (target: Invitation) => {

    if (!currentUser || ![target.senderId, target.recipientId].includes(currentUser.id)) return;
    const post = meetupPosts.find(item => item.id === target.postId);
    setInvitations(prev => prev.map(item => item.id === target.id && item.recipientId === currentUser.id && item.status === 'received' ? { ...item, status: 'viewed', viewedAt: clock().toISOString() } : item));
    setNotifications(prev => prev.map(item => item.targetType === 'invitation' && item.targetId === target.id && item.recipientId === currentUser.id ? { ...item, read: true } : item));
    setSelectedPostForDetail(post || null);
    if (!post) setLifecycleNotice('삭제된 공고예요. 초대 기록은 Me에 남아 있어요.');
  };
  const changeStrangerInvitationNotice = (enabled: boolean) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    if (!currentUser) return;
    setNotificationSettings(prev => prev.some(item => item.userId === currentUser.id)
      ? prev.map(item => item.userId === currentUser.id ? { ...item, strangerInvitations: enabled } : item)
      : [...prev, { userId: currentUser.id, strangerInvitations: enabled }]);
  };
  const activeAppointmentsWith = (targetId: string) => appointments.filter(item =>
    currentUser && item.participantIds?.includes(currentUser.id) && item.participantIds.includes(targetId) && isConfirmedAppointment(item));
  const confirmBlock = (member: ChatMember) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }

    if (!currentUser || member.id === currentUser.id) return;
    const impact = blockImpact(appointments, completions, currentUser.id, member.id);
    if (impact.mode === 'hold') { setLifecycleNotice(`${impact.code} 검토 보류: ${impact.reason}`); return; }
    let state: LifecycleState | null = lifecycleState();
    for (const item of impact.appointments) {
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
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        setLifecycleNotice('로그아웃하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.');
        return;
      }
      setProfileEditor(null); setIsProfilePreviewOpen(false); setSafetyDialog(null);
      setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
      navigate('/', true);
      return;
    }
    setCurrentUser(null);
    setProfileEditor(null); setIsProfilePreviewOpen(false); setSafetyDialog(null);
    setActiveRoomId(null); setIsDashboardOpen(false); setIsReviewModalOpen(false); setSelectedChatProfile(null);
    navigate('/', true);
  };


  // Phase 6: Pro Escrow Payment Handlers
  const handleOpenEscrow = (post: MeetupPost) => {
    if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; }
    setSelectedPostForDetail(null);
    setSelectedProPostForEscrow(post);
    setIsEscrowModalOpen(true);
  };

  const postAuthor = (post: MeetupPost): ChatMember => ({ id: post.authorId || `unknown-${post.id}`, displayName: post.author, avatar: post.avatar });
  const withReleasedReviews = (profile: ReturnType<typeof publicProfileForMember>) => ({
    ...profile,
    reviews: [
      ...profile.reviews,
      ...releasedReviewsFor(profile.id, appointmentReviews).map(review => ({
        id: review.id,
        author: userById(review.reviewerId)?.maskedName || '동행 이웃',
        rating: review.rating,
        comment: review.comment || [...review.positiveItems, ...review.negativeItems].join(' · '),
      })),
    ],
  });
  const profileForMember = (member: ChatMember, viewer = currentUser) => {
    if (demoMode) return withReleasedReviews(publicProfileForMember(member, viewer, users));
    // Normal runs: server-masked name/age/photo/bio only; no sample hobbies, badges or reviews.
    const loaded = live.profiles[member.id];
    const base = publicProfileForMember(member, viewer, users);
    return loaded || { ...base, sugarContent: NEW_USER_SUGAR_POLICY };
  };
  const profileForPost = (post: MeetupPost) => demoMode
    ? withReleasedReviews(publicProfileForPost(post, currentUser, users))
    : profileForMember(postAuthor(post));
  const authorSugarOf = (post: MeetupPost) => profileForPost(post).sugarContent;
  /** The other participant, seen from the signed-in user (the stored partnerName is only the accepting side's view). */
  const partnerOf = (target: Appointment): ChatMember | undefined => {
    const member = chatRooms.find(room => room.appointmentId === target.id)?.members.find(item => item.id !== currentUser?.id);
    if (member) return member;
    const otherId = target.participantIds?.find(id => id !== currentUser?.id);
    const account = otherId ? userById(otherId) : undefined;
    return otherId ? { id: otherId, displayName: account?.maskedName || target.partnerName, avatar: account?.avatar || target.partnerAvatar } : undefined;
  };
  const currentNotificationSettings = notificationSettingsFor(notificationSettings, currentUser?.id || '');
  const openNotificationTarget = (item: NotificationItem) => {

    if (!currentUser || item.recipientId !== currentUser.id) return;
    setNotifications(prev => prev.map(value => value.id === item.id ? { ...value, read: true } : value));
    setIsNotificationsOpen(false);
    if (item.targetType === 'invitation' && item.targetId) {
      const invitation = invitations.find(value => value.id === item.targetId);
      if (invitation) openInvitation(invitation);
      return;
    }
    if ((item.targetType === 'room' || item.roomId) && (item.targetId || item.roomId)) {
      const room = chatRooms.find(value => value.id === (item.targetId || item.roomId));
      if (room) openRoom(room);
      return;
    }
    if (item.targetType === 'post' && item.targetId) {
      const post = meetupPosts.find(value => value.id === item.targetId);
      if (post) setSelectedPostForDetail(post);
      else setLifecycleNotice('현재 공고를 찾을 수 없어요. 종료·삭제된 기록은 Me에서 확인해 주세요.');
      return;
    }
    if ((item.targetType === 'appointment' || item.targetType === 'review') && item.targetId) {
      const target = appointments.find(value => value.id === item.targetId);
      if (target) openAppointment(target);
      return;
    }
    if (item.action === 'match_requests') { setRequestTab('received'); setActiveTab('me'); }
  };
  const detailEvent = selectedPostForDetail?.eventId ? eventById(selectedPostForDetail.eventId) : undefined;
  const dashboardPartner = chatRooms.find(room => room.appointmentId === appointment?.id)?.members.find(member => member.id !== currentUser?.id);
  const dashboardProfile = dashboardPartner ? profileForMember(dashboardPartner) : undefined;
  const completionActionsFor = (target: Appointment) => ({
    state: completionReviewState(target, currentUser?.id, completions, appointmentReviews, now),
    onComplete: () => handleCompleteAppointment(target),
    onDispute: () => handleDisputeAppointment(target),
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
  const startDemoSegment = (segment: 'full' | 'matching' | 'completion') => {
    if (!demoMode) return;
    if (segment === 'full') {
      setCurrentUser(null); setActiveTab('home'); setIsAuthModalOpen(true);
      setLifecycleNotice('전체 시연: 가입 → 프로필 완성 → 공고 탐색·신청 → 작성자 수락 → 종료 뒤 각자 완료·평가 순서로 진행해 보세요.');
      return;
    }
    const demoUser = users.find(user => user.id === DEMO_USER_ID);
    if (demoUser) setCurrentUser({ ...demoUser, isLoggedIn: true });
    if (segment === 'matching') {
      setActiveTab('explore'); setExploreFilters(emptyExploreFilters());
      setLifecycleNotice('매칭 구간: 공고 상세에서 신청하고, 체험 설정의 역할을 작성자로 바꿔 최종 수락해 보세요.');
      return;
    }
    const target = appointments.find(item => item.id === 'appt-walk') || appointments.find(item => item.participantIds?.includes(DEMO_USER_ID));
    if (target) {
      setActiveAppointmentId(target.id); setReviewAppointmentId(target.id);
      if (target.endsAt) changeTimeOffset(Date.parse(target.endsAt) - Date.now());
      setActiveTab('me'); setIsDashboardOpen(true);
      setLifecycleNotice('완료·평가 구간: 정확한 종료 시각부터 내 완료를 확인하고 평가하세요. 상대 역할 전환으로 별도 완료·평가를 제출할 수 있어요.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex justify-center selection:bg-purple-100">
      {/* Mobile container simulating the exact mobile app interface */}
      <main style={{ '--service-banner-h': `${serviceBannerHeight}px` } as React.CSSProperties} className="w-full max-w-[440px] min-h-screen bg-white shadow-xl relative flex flex-col">
        {demoMode && <DemoControlPanel
          users={users} activeUserId={currentUser?.id || null} now={now} settings={demoSettings}
          onSwitchUser={switchDemoUser}
          onSetTimeOffset={changeTimeOffset}
          onSetTime={iso => changeTimeOffset(Date.parse(iso) - Date.now())}
          onChangeVariant={(key, value) => setDemoSettings(prev => ({ ...prev, variants: { ...prev.variants, [key]: value } }))}
          onStartSegment={startDemoSegment}
          onReset={resetPrototype}
        />}
        {storageIssue && <div role="alert" data-storage-issue={storageIssue} className="bg-red-50 text-red-900 text-xs px-4 py-2.5 border-b border-red-100">
          <p className="leading-relaxed">{storageIssueMessage[storageIssue]}</p>
          <div className="flex gap-2 mt-1.5 justify-end">
            <button type="button" onClick={retryStorage} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 font-bold">저장 다시 시도</button>
            <button type="button" onClick={resetPrototype} className="rounded-lg bg-red-600 text-white px-2.5 py-1 font-bold">저장 데이터 초기화</button>
          </div>
        </div>}
        {!demoMode && <div ref={serviceBannerRef} role="status" className="bg-amber-50 px-4 py-2 text-xs text-amber-950 border-b border-amber-100">휴대폰 로그인·회원가입 · 테스트 번호는 Supabase가 고정 OTP 123456을 검증하며 실제 문자는 발송하지 않아요.</div>}
        {/* Top Header */}
        <Header
          unreadCount={unreadNotifCount}
          onOpenNotifications={() => currentUser ? setIsNotificationsOpen(true) : setIsAuthModalOpen(true)}
          currentUser={privateDataReady ? currentUser : null}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          guestLabel={supabaseAuth.status === 'profile-incomplete' ? '가입 계속' : '로그인'}
        />
        {privateDataReady && currentUser && profileMissing.length > 0 && !profileEditor && activeTab !== 'me' && <div role="status" data-profile-incomplete-bar className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-950">
          <span className="flex-1 min-w-0">프로필 미완성 · 남은 단계 {profileMissing.map(step => profileStepLabel[step]).join(' · ')}</span>
          <button type="button" onClick={() => setProfileEditor({ mode: 'setup', step: profileMissing[0] })} className="shrink-0 rounded-lg bg-amber-900 text-white px-2.5 py-1 font-bold">이어서 작성</button>
        </div>}

        {isProtectedPath(path) && !privateAreaAllowed && <AuthGate
          status={supabaseAuth.status === 'loading' ? 'loading' : supabaseAuth.status === 'error' ? 'error' : 'anonymous'}
          error={supabaseAuth.error}
          onRetry={() => void supabaseAuth.refresh()}
          onLogin={() => setIsAuthModalOpen(true)}
        />}
        {isProtectedPath(path) && privateAreaAllowed && !privateDataReady && <div aria-hidden="true" className="flex-1 p-5 space-y-4 animate-pulse">
          <div className="h-7 w-28 rounded-lg bg-gray-100" />
          {[0, 1, 2].map(item => <div key={item} className="h-20 rounded-2xl bg-gray-100" />)}
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
        {activeTab === 'chat' && privateDataReady && <div className="flex-1 flex flex-col" data-chat-storage="browser">
          {activeRoom && currentUser && activePartner ? <ChatView key={activeRoom.id}
            room={activeRoom} user={currentUser} partner={profileForMember(activePartner)} post={activeRoomPost} request={activeRoomRequest} appointment={activeRoomAppointment}
            status={accessOf(activeRoom)}
            completionActions={activeRoomAppointment ? completionActionsFor(activeRoomAppointment) : undefined}
            onBack={() => setActiveRoomId(null)} onOpenProfile={() => setSelectedChatProfile(activePartner)}
            onOpenPost={() => activeRoomPost && setSelectedPostForDetail(activeRoomPost)}
            onOpenDashboard={() => activeRoomAppointment && openAppointment(activeRoomAppointment)}
            onOpenVoiceCall={() => { if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; } if(activeRoomAppointment) { setActiveAppointmentId(activeRoomAppointment.id); setIsVoiceCallOpen(true); } }}
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
        {activeTab === 'me' && privateDataReady && (
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
              referralCodeEnabled={!demoMode}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenKyc={() => demoMode ? setIsKycModalOpen(true) : setLifecycleNotice(NOT_READY_NOTICE)}
              onLogout={handleLogout}
              profileMissing={profileMissing}
              onEditProfile={step => demoMode ? setProfileEditor(profileMissing.length ? { mode: 'setup', step: step || profileMissing[0] } : { mode: 'edit' }) : setLifecycleNotice(NOT_READY_NOTICE)}
              onPreviewProfile={() => setIsProfilePreviewOpen(true)}
              reviews={reviews}
              escrowPayments={escrowPayments}
              invitations={invitations}
              favorites={favorites}
              completions={completions}
              appointmentReviews={appointmentReviews}
              blocks={blocks}
              notificationSettings={currentNotificationSettings}
              users={users}
              now={now}
              userNameOf={id => userById(id)?.maskedName || meetupPosts.find(post => post.authorId === id)?.author || '회원'}
              partnerOf={partnerOf}
              onOpenAppointmentChat={target => { const room = chatRooms.find(item => item.appointmentId === target.id); if (room) openRoom(room); }}
              onOpenPartnerProfile={setSelectedChatProfile}
              onOpenInvitationPost={item => demoMode ? openInvitation(item) : setLifecycleNotice(NOT_READY_NOTICE)}
              onToggleFavoriteNotice={toggleFavoriteNotice}
              onRemoveFavorite={toggleFavorite}
              onInviteFavorite={inviteFavorite}
              onOpenFavoriteProfile={openProfileById}
              onChangeStrangerInvitationNotice={changeStrangerInvitationNotice}
              onUnblock={targetId => { if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; } setBlocks(prev => prev.filter(item => !(item.blockerId === currentUser.id && item.blockedId === targetId))); setLifecycleNotice('차단을 해제했어요. 이전에 취소된 동행은 복구되지 않아요.'); }}
              onApplyAiFilters={filters => { if (!demoMode) { setLifecycleNotice(NOT_READY_NOTICE); return; } setExploreFilters(filters); setActiveTab('explore'); setLifecycleNotice('수정 가능한 예시 조건을 둘러보기에 적용했어요. 실제 AI 호출 결과는 아니에요.'); }}
              acceptBlockedReason={acceptBlockedReason}
            />
          </div>
        )}

        {/* Bottom Navigation Bar + FAB (+) Button */}
        <BottomNav
          activeTab={activeTab}
          unreadChatCount={privateDataReady ? notifications.filter(item => !item.read && item.type === 'chat' && chatRooms.some(room => room.id === item.roomId && room.members.some(member => member.id === currentUser?.id))).length : 0}
          onChangeTab={(tab) => setActiveTab(tab)}
          onOpenCreate={() => handleOpenCreateMeetup()}
        />

        {/* Modal: 참여 대시보드 */}
        {privateDataReady && appointment && <DashboardModal
          appointment={appointment}
          isOpen={isDashboardOpen && Boolean(currentUser && appointment?.participantIds?.includes(currentUser.id))}
          onClose={() => setIsDashboardOpen(false)}
          onOpenChat={() => {
            setIsDashboardOpen(false);
            const room = chatRooms.find(item => item.appointmentId === appointment.id);
            if (room) openRoom(room);
            else { setActiveRoomId(null); setActiveTab('chat'); }
          }}
          onOpenSafetyRules={() => setIsSafetyRulesOpen(true)}
          onOpenReport={() => demoMode ? setIsReportOpen(true) : setLifecycleNotice(NOT_READY_NOTICE)}
          onSendArrivalNotice={handleSendArrivalNotice}
          onCancelAppointment={() => openAppointmentCancellation(appointment)}
          partnerProfile={dashboardProfile}
          onOpenPartnerProfile={() => dashboardPartner && setSelectedChatProfile(dashboardPartner)}
          completionActions={completionActionsFor(appointment)}
        />}

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
          isOpen={isCreateModalOpen && privateDataReady}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPost(null);
            setCreateContext(null);
          }}
          onCreateMeetup={handleCreateMeetup}
          onUpdatePost={handleUpdatePost}
          editPost={editingPost}
          currentUser={privateDataReady ? currentUser : null}
          now={now}
          variant={demoSettings.variants.postForm}
          showVariantLabel={demoMode}
          initialCategory={createContext?.category}
          serviceMode={!demoMode}
          onUnavailable={() => setLifecycleNotice(NOT_READY_NOTICE)}
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
          canViewPrivateLocation={privateDataReady && (demoMode
            ? canViewSecretLocation(selectedPostForDetail?.id, appointments, currentUser?.id)
            // RLS returned the exact place only to the author or the confirmed companion.
            : Boolean(selectedPostForDetail?.secretLocation))}
          authorProfile={selectedPostForDetail ? profileForMember(postAuthor(selectedPostForDetail)) : null}
          onOpenAuthorProfile={() => { if (!selectedPostForDetail) return; if (!demoMode && !privateDataReady) { setIsAuthModalOpen(true); return; } setSelectedChatProfile(postAuthor(selectedPostForDetail)); }}
          isCovered={Boolean(selectedChatProfile)}
          now={now}
          eligibility={requestEligibility(selectedPostForDetail || {}, currentUser)}
          linkedEventTitle={detailEvent?.title}
        />

        {/* Phase 3 Modal: 1:1 동행 신청서 모달 (신청자) */}
        <JoinRequestModal
          post={meetupPosts.find(post => post.id === selectedPostForJoin?.id) || null}
          isOpen={isJoinRequestModalOpen && privateDataReady}
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
          isOpen={isVoiceCallOpen && privateDataReady}
          onClose={() => setIsVoiceCallOpen(false)}
          appointment={appointment}
        />

        {/* Phase 4 Modal: 긴급 신고 및 노쇼(No-Show) 센터 모달 */}
        <ReportModal
          isOpen={isReportOpen && privateDataReady}
          onClose={() => setIsReportOpen(false)}
          appointment={appointment}
          onSubmitReport={handleReportSubmit}
        />

        {/* Modal: 알림 창 */}
        <NotificationModal
          isOpen={isNotificationsOpen && privateDataReady}
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
          onOpenTarget={openNotificationTarget}
        />

        {privateDataReady && selectedChatProfile && <UserProfileModal
          key={selectedChatProfile.id}
          profile={profileForMember(selectedChatProfile)}
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
            onReport: () => demoMode ? setSafetyDialog({ kind: 'report', member: selectedChatProfile }) : setLifecycleNotice(NOT_READY_NOTICE),
            onBlock: () => demoMode ? setSafetyDialog({ kind: 'block', member: selectedChatProfile }) : setLifecycleNotice(NOT_READY_NOTICE),
            onLoginRequired: () => { setSelectedChatProfile(null); setIsAuthModalOpen(true); },
          }}
        />}
        {privateDataReady && isProfilePreviewOpen && currentUser && <UserProfileModal profile={profileForMember(selfMember(currentUser))}
          variant={demoSettings.variants.profile} showVariantLabel={demoMode} selfPreview backLabel="Me로 돌아가기" onClose={() => setIsProfilePreviewOpen(false)} />}
        {privateDataReady && profileEditor && currentUser && <ProfileEditor
          key={`${currentUser.id}-${profileEditor.mode}`}
          user={currentUser} mode={profileEditor.mode} initialStep={profileEditor.step} reason={profileEditor.reason}
          variant={demoSettings.variants.profile} showVariantLabel={demoMode}
          previewOf={patch => withReleasedReviews(publicProfileForMember(selfMember(currentUser), { ...currentUser, ...patch }, users))}
          onCommit={commitProfile}
          onClose={() => setProfileEditor(null)}
          onDone={() => { setProfileEditor(null); setLifecycleNotice(profileEditor.mode === 'setup' ? '프로필을 저장했어요. 이제 동행을 신청하거나 공고를 올릴 수 있어요.' : '프로필 변경을 저장했어요.'); }}
        />}
        {privateDataReady && safetyDialog?.kind === 'report' && <ReportUserDialog targetName={safetyDialog.member.displayName} onClose={() => setSafetyDialog(null)}
          onSubmit={(reason, details) => {  setSafetyDialog(null); setLifecycleNotice('신고를 예시로 접수했어요. 실제 운영팀 전달이나 자동 제재는 없어요.'); }} />}
        {privateDataReady && safetyDialog?.kind === 'block' && <BlockUserDialog targetName={safetyDialog.member.displayName}
          affectedTitles={activeAppointmentsWith(safetyDialog.member.id).map(item => item.title)}
          holdReason={currentUser && blockImpact(appointments, completions, currentUser.id, safetyDialog.member.id).mode === 'hold' ? (blockImpact(appointments, completions, currentUser.id, safetyDialog.member.id) as Extract<ReturnType<typeof blockImpact>, { mode: 'hold' }>).reason : undefined}
          onClose={() => setSafetyDialog(null)} onConfirm={() => confirmBlock(safetyDialog.member)} />}
        {privateDataReady && postAction && <LifecycleConfirmDialog title={postAction.mode === 'deleted' ? '공고 삭제' : '모집 마감'} description={postAction.mode === 'deleted' ? '공고를 목록에서 지우고 남아 있는 신청을 종료합니다. 기존 신청·대화 기록은 보존돼요.' : '새 신청을 받지 않고 미확정 신청을 함께 종료합니다. 동행이 확정되는 것은 아니에요.'} actionLabel={postAction.mode === 'deleted' ? '공고 삭제하기' : '모집 마감하기'} onClose={() => setPostAction(null)} onConfirm={confirmPostAction} />}
        {privateDataReady && cancellationTarget && <CancellationDialog key={cancellationTarget.id} kind={cancellationTarget.kind} title={cancellationTarget.title} onClose={() => setCancellationTarget(null)} onConfirm={confirmCancellation} />}
        {privateDataReady && conflictPrompt && <ScheduleConflictDialog conflicts={conflictPrompt.conflicts} onClose={() => setConflictPrompt(null)} onContinue={continueConflict} />}
        {lifecycleNotice && <div role="alert" className="fixed bottom-24 left-5 right-5 mx-auto max-w-sm bg-gray-900 text-white p-4 rounded-2xl z-[95] text-xs leading-relaxed shadow-lg">{lifecycleNotice}<button onClick={() => setLifecycleNotice(null)} className="block ml-auto mt-2 font-bold underline">안내 닫기</button></div>}
        {/* Modal: 회원가입 / 휴대폰 본인확인 (Phase 1) */}
        {demoMode ? <DemoAuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuth}
          onAuthSuccess={handleAuthSuccess}
          users={users}
          now={now}
        /> : <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuth}
          profileIncomplete={supabaseAuth.status === 'profile-incomplete'}
          onProfileSaved={supabaseAuth.refresh}
          now={now}
        />}

        {/* Modal: 선택형 KYC 본인확인 (Phase 1) */}
        <KycAuthModal
          isOpen={isKycModalOpen && privateDataReady}
          onClose={() => setIsKycModalOpen(false)}
          isAlreadyVerified={currentUser?.isKycVerified || false}
        />

        {/* Phase 5 Modal: 상호 블라인드 평가 및 실시간 당도 정산 모달 */}
        {isReviewModalOpen && privateDataReady && <ReviewModal
          key={reviewAppointment.id}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          appointment={reviewAppointment}
          partnerName={partnerOf(reviewAppointment)?.displayName || reviewAppointment.partnerName}
          variant={demoSettings.variants.review}
          state={completionReviewState(reviewAppointment, currentUser?.id, completions, appointmentReviews, now)}
          ownReview={appointmentReviews.find(item => item.appointmentId === reviewAppointment.id && item.reviewerId === currentUser?.id)}
          partnerReview={appointmentReviews.find(item => item.appointmentId === reviewAppointment.id && item.reviewerId !== currentUser?.id)}
          ratingAndCommentOnly={!demoMode}
          onSubmitReview={handleSubmitReview}
        />}

        {/* Phase 6 Modal: PRO 1:1 안심 에스크로 결제 모달 */}
        <EscrowPaymentModal
          isOpen={isEscrowModalOpen && privateDataReady}
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
