// Supabase data source for the existing screens in normal (non-demo) runs.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Appointment, AppointmentReview, ChatMember, ChatRoom, CompletionConfirmation, JoinRequest, MeetupPost, NotificationItem, PublicUserProfile } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { resolveProfileAvatar } from '../profile/avatarStorage';
import { toLiveError } from './errors';
import { liveApi, type AppointmentState, type SentRequest, type ReceivedRequest } from './api';
import {
  avatarOrPlaceholder, toAppointment, toAppointmentReviews, toChatRoom, toCompletion, toJoinRequest, toMeetupPost, toNotification,
  type AppointmentRow, type AuthorCard, type JoinRow, type LivePostRow, type MessageRow, type NotificationRow, type ReviewStateRow,
} from './adapters';

export interface LiveData {
  posts: MeetupPost[];
  requests: JoinRequest[];
  rooms: ChatRoom[];
  appointments: Appointment[];
  completions: CompletionConfirmation[];
  appointmentReviews: AppointmentReview[];
  notifications: NotificationItem[];
}
const EMPTY: LiveData = { posts: [], requests: [], rooms: [], appointments: [], completions: [], appointmentReviews: [], notifications: [] };
type Result = { ok: true } | { ok: false; error: string };

const client = () => getSupabaseClient();
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw toLiveError(error);
  return data || [];
}

export function useLiveBackend(enabled: boolean, userId: string | null, self: ChatMember | null) {
  const [data, setData] = useState<LiveData>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, PublicUserProfile>>({});
  const sequence = useRef(0);
  const selfRef = useRef(self);
  selfRef.current = self;
  // Where to ask the server for someone's safe profile: a post they wrote or a request we share.
  const profileSource = useRef<Record<string, { postId?: string; requestId?: string }>>({});

  const inFlight = useRef(false);
  const inFlightSince = useRef(0);
  const rerun = useRef(false);
  const load = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    // One load at a time: triggers during a load coalesce into one follow-up instead of cancelling it forever.
    // A request that never settles must not block every later refresh.
    if (inFlight.current && Date.now() - inFlightSince.current < 20000) { rerun.current = true; return; }
    inFlight.current = true;
    inFlightSince.current = Date.now();
    const current = ++sequence.current;
    try {
      const recruiting: LivePostRow[] = [];
      let cursor: { starts_at: string; id: string } | undefined;
      for (let page = 0; page < 4; page++) {
        const pageRows = await rows<LivePostRow>(client().rpc('list_posts', { p_after_starts_at: cursor?.starts_at ?? null, p_after_id: cursor?.id ?? null, p_limit: 50 }));
        recruiting.push(...pageRows);
        if (pageRows.length < 50) break;
        cursor = { starts_at: pageRows.at(-1)!.starts_at, id: pageRows.at(-1)!.id };
      }
      const postRows = new Map(recruiting.map(row => [row.id, row]));
      let joins: JoinRow[] = [], sent: SentRequest[] = [], received: ReceivedRequest[] = [];
      let appointments: AppointmentRow[] = [], completions: { appointment_id: string; user_id: string; confirmed_at: string }[] = [];
      let exact: { post_id: string; exact_location: string }[] = [], messages: MessageRow[] = [], cards: AuthorCard[] = [], notificationRows: NotificationRow[] = [];
      const appointmentStates: AppointmentState[] = [];
      const reviewStates: ReviewStateRow[] = [];

      if (userId) {
        const [mine, joinRows, sentRows, receivedRows, appointmentRows, completionRows, exactRows, storedNotifications] = await Promise.all([
          rows<LivePostRow>(client().from('posts').select('*').eq('author_id', userId)),
          rows<JoinRow>(client().from('join_requests').select('id,post_id,requester_id,message,status,created_at,updated_at')),
          liveApi.sentRequests(), liveApi.receivedRequests(),
          rows<AppointmentRow>(client().from('appointments').select('id,post_id,join_request_id,status,confirmed_at,completed_at')),
          rows<{ appointment_id: string; user_id: string; confirmed_at: string }>(client().from('appointment_completion_confirmations').select('appointment_id,user_id,confirmed_at')),
          rows<{ post_id: string; exact_location: string }>(client().from('post_private_details').select('post_id,exact_location')),
          rows<NotificationRow>(client().from('notifications').select('id,recipient_id,kind,join_request_id,created_at,read_at').order('created_at', { ascending: false }).limit(100)),
        ]);
        mine.forEach(row => postRows.set(row.id, row));
        joins = joinRows; sent = sentRows; received = receivedRows; appointments = appointmentRows; completions = completionRows; exact = exactRows; notificationRows = storedNotifications;
        const missing = [...new Set(joins.map(row => row.post_id))].filter(id => !postRows.has(id));
        if (missing.length) (await rows<LivePostRow>(client().from('posts').select('*').in('id', missing))).forEach(row => postRows.set(row.id, row));
        if (joins.length) messages = await rows<MessageRow>(client().from('chat_messages').select('id,join_request_id,sender_id,content,created_at')
          .in('join_request_id', joins.map(row => row.id)).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(2000));
        if (postRows.size) cards = await rows<AuthorCard>(client().rpc('get_post_author_discovery_cards', { p_post_ids: [...postRows.keys()] }));
        const states = await Promise.all(appointments.map(async appointment => {
          const [appointmentState, reviewState] = await Promise.all([
            liveApi.appointmentState(appointment.id),
            liveApi.reviewState(appointment.id),
          ]);
          return { appointment: appointmentState, review: reviewState };
        }));
        states.forEach(state => {
          if (state.appointment) appointmentStates.push(state.appointment);
          if (state.review) reviewStates.push(state.review);
        });

        const signed = (value: string | null) => resolveProfileAvatar(value, userId).catch(() => '');
        cards = await Promise.all(cards.map(async card => ({ ...card, avatar_url: await signed(card.avatar_url) })));
        received = await Promise.all(received.map(async request => ({ ...request, requester_avatar_url: await signed(request.requester_avatar_url) })));
        await Promise.all(appointmentStates.map(async state => {
          state.counterpart_avatar_url = await signed(state.counterpart_avatar_url);
        }));
      }
      if (current !== sequence.current) return;

      const cardByPost = new Map(cards.map(card => [card.post_id, card]));
      const exactByPost = new Map(exact.map(row => [row.post_id, row.exact_location]));
      const appointmentByPost = new Map(appointments.map(row => [row.post_id, row]));
      const posts = [...postRows.values()].map(row => toMeetupPost(row, cardByPost.get(row.id), exactByPost.get(row.id), appointmentByPost.has(row.id)));
      const postById = new Map(posts.map(post => [post.id, post]));
      const sentById = new Map(sent.map(row => [row.id, row]));
      const receivedById = new Map(received.map(row => [row.id, row]));
      const me = selfRef.current;

      const sources: Record<string, { postId?: string; requestId?: string }> = {};
      posts.forEach(post => { if (post.authorId) sources[post.authorId] ||= { postId: post.id }; });

      const requests = joins.map(row => {
        const post = postById.get(row.post_id);
        const incoming = receivedById.get(row.id);
        const requester = row.requester_id === userId && me
          ? { name: me.displayName, avatar: me.avatar }
          : { name: incoming?.requester_masked_name || '신청자', avatar: avatarOrPlaceholder(incoming?.requester_avatar_url), age: incoming?.requester_age ?? undefined };
        if (row.requester_id !== userId) sources[row.requester_id] = { requestId: row.id };
        const request = toJoinRequest(row, post, requester);
        // A sent request whose post card was not returned still shows the server-masked author name.
        if (post && post.author === '작성자' && sentById.get(row.id)) post.author = sentById.get(row.id)!.author_masked_name;
        return request;
      });
      const requestById = new Map(requests.map(request => [request.id, request]));
      const memberOf = (id: string, fallback: ChatMember): ChatMember => (id === userId && me ? me : fallback);
      const rooms = requests.map(request => {
        const post = postById.get(request.postId);
        const host = memberOf(request.hostId, { id: request.hostId, displayName: post?.author || '작성자', avatar: post?.avatar || avatarOrPlaceholder(null) });
        const requester = memberOf(request.requesterId, { id: request.requesterId, displayName: request.requesterName, avatar: request.requesterAvatar });
        return toChatRoom(request, post, host, requester, messages.filter(message => message.join_request_id === request.id), appointments.find(row => row.join_request_id === request.id)?.id);
      });
      const mappedAppointments = appointments.flatMap(row => {
        const post = postById.get(row.post_id);
        const request = requestById.get(row.join_request_id);
        if (!post || !request || !userId) return [];
        const room = rooms.find(item => item.requestId === request.id)!;
        const partner = room.members.find(member => member.id !== userId)!;
        return [toAppointment(
          row,
          post,
          request,
          userId,
          partner,
          appointmentStates.find(state => state.appointment_id === row.id),
          reviewStates.find(state => state.appointment_id === row.id),
        )];
      });
      const appointmentReviews = reviewStates.flatMap(state => {
        const appointment = mappedAppointments.find(item => item.id === state.appointment_id);
        const partnerId = appointment?.participantIds?.find(id => id !== userId);
        return appointment && partnerId && userId ? toAppointmentReviews(state, userId, partnerId) : [];
      });
      const notifications = notificationRows.map(row => toNotification(row, requestById.get(row.join_request_id)));

      profileSource.current = sources;
      setData({ posts, requests, rooms, appointments: mappedAppointments, completions: completions.map(toCompletion), appointmentReviews, notifications });
      setStatus('ready'); setError(null);
    } catch (err: any) {
      if (current === sequence.current) { setStatus('error'); setError(err?.message || '데이터를 불러오지 못했어요.'); }
    } finally {
      inFlight.current = false;
      // Always follow up with the latest closure (the account may have changed meanwhile).
      if (rerun.current) { rerun.current = false; void loadRef.current(); }
    }
  }, [enabled, userId]);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setData(EMPTY); setProfiles({});
    sequence.current++; // results of a load started for a previous account are discarded
    if (enabled) { setStatus('loading'); if (inFlight.current) rerun.current = true; else void load(); }
  }, [enabled, userId, load]);

  // Public list for visitors who are not logged in: refresh on focus and periodically.
  useEffect(() => {
    if (!enabled || userId) return;
    const poll = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, [enabled, userId, load]);

  // Private changes arrive over Realtime (RLS-filtered); reviews are re-read through the safe RPC.
  useEffect(() => {
    if (!enabled || !userId) return;
    let timer: number | undefined;
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 300); };
    let channel: ReturnType<ReturnType<typeof client>['channel']> | null = null;
    let cancelled = false;
    void (async () => {
      const { data: session } = await client().auth.getSession();
      if (cancelled || !session.session) return;
      await client().realtime.setAuth(session.session.access_token);
      channel = client().channel(`existing-ui:${userId}:${crypto.randomUUID()}`);
      for (const table of ['chat_messages', 'join_requests', 'appointments', 'appointment_completion_confirmations', 'notifications'])
        channel.on('postgres_changes' as any, { event: '*', schema: 'public', table }, schedule);
      channel.on('system' as any, {}, (payload: any) => { if (payload?.extension === 'postgres_changes' && payload.status === 'ok') schedule(); });
      channel.subscribe();
    })();
    const poll = window.setInterval(() => void load(), 15000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true; window.clearTimeout(timer); window.clearInterval(poll); window.removeEventListener('focus', onFocus);
      if (channel) void client().removeChannel(channel);
    };
  }, [enabled, userId, load]);

  /** Loads the server-safe public profile (masked name, full age, photo, bio) for a member once. */
  const ensureProfile = useCallback(async (memberId: string) => {
    if (!enabled || !userId || profiles[memberId]) return;
    const source = profileSource.current[memberId];
    if (!source) return;
    try {
      const profile = source.requestId ? await liveApi.counterpartProfile(source.requestId) : await liveApi.authorProfile(source.postId!);
      if (!profile) return;
      const avatar = await resolveProfileAvatar(profile.avatar_url, userId).catch(() => '');
      setProfiles(previous => ({
        ...previous,
        [memberId]: {
          id: memberId, displayName: profile.masked_name, avatar: avatarOrPlaceholder(avatar), bio: profile.bio || '',
          neighborhood: '', ageGroup: typeof profile.age === 'number' ? `만 ${profile.age}세` : '', gender: profile.gender, hobbies: [], traits: [],
          sugarContent: null, isPhoneVerified: false, isKycVerified: false, isSample: false, reviews: [],
        },
      }));
    } catch { /* profile stays as the list-level masked name */ }
  }, [enabled, userId, profiles]);

  const run = useCallback(async (fn: () => Promise<unknown>): Promise<Result> => {
    try { await fn(); await load(); return { ok: true }; }
    catch (err: any) { await load(); return { ok: false, error: err?.message || '요청을 처리하지 못했어요.' }; }
  }, [load]);

  const actions = {
    createPost: (args: Record<string, unknown>) => run(() => liveApi.createPost(args)),
    createRequest: async (postId: string, message: string): Promise<Result & { requestId?: string }> => {
      try { const created = await liveApi.createJoinRequest(postId, message); await load(); return { ok: true, requestId: created.id }; }
      catch (err: any) { return { ok: false, error: err?.message || '신청하지 못했어요.' }; }
    },
    confirmMatch: (requestId: string) => run(() => liveApi.confirmMatch(requestId)),
    decline: (requestId: string) => run(() => liveApi.declineJoinRequest(requestId)),
    withdraw: (requestId: string) => run(() => liveApi.withdrawJoinRequest(requestId)),
    sendMessage: (requestId: string, text: string) => run(() => liveApi.sendMessage({ id: crypto.randomUUID(), join_request_id: requestId, sender_id: userId!, content: text })),
    confirmCompletion: (appointmentId: string) => run(() => liveApi.confirmCompletion(appointmentId)),
    raiseDispute: (appointmentId: string, reason: string) => run(() => liveApi.raiseDispute(appointmentId, reason)),
    submitReview: (appointmentId: string, rating: number, comment: string) => run(() => liveApi.submitReview(appointmentId, rating, comment)),
    markNotificationRead: (notificationId: string) => run(() => liveApi.markNotificationRead(notificationId)),
    markAllNotificationsRead: () => run(() => liveApi.markAllNotificationsRead()),
  };

  return { data, status, error, profiles, ensureProfile, reload: load, actions };
}
