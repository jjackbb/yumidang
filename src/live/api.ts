// Typed Supabase calls for the live (non-demo) app. Only the publishable key and the member's session are used.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { toLiveError } from './errors';

export { LiveApiError, toLiveError } from './errors';

export interface Post {
  id: string; author_id: string; title: string; description: string; category: string;
  starts_at: string; ends_at: string; recruitment_ends_at: string; public_area: string;
  preference_note: string | null; tags: string[]; capacity: number;
  status: 'recruiting' | 'closed' | 'expired' | 'deleted'; created_at: string; updated_at: string;
}
export interface PostFilters { query: string; date: string; category: string; area: string }
export interface PublicProfile { masked_name: string; age: number | null; avatar_url: string | null; bio: string | null }
export type RequestStatus = 'pending' | 'withdrawn' | 'declined' | 'matched' | 'not_selected';
export interface SentRequest {
  id: string; post_id: string; post_title: string; post_starts_at: string; post_ends_at: string; post_public_area: string;
  post_status: Post['status']; author_masked_name: string; message: string; status: RequestStatus; created_at: string; updated_at: string;
}
export interface ReceivedRequest {
  id: string; post_id: string; post_title: string; post_starts_at: string; post_status: Post['status'];
  requester_masked_name: string; requester_age: number | null; requester_avatar_url: string | null;
  message: string; status: RequestStatus; created_at: string; updated_at: string;
}
export interface Conversation {
  request_id: string; my_role: 'requester' | 'author'; request_status: RequestStatus; request_message: string; request_created_at: string;
  post_id: string; post_title: string; post_starts_at: string; post_ends_at: string; post_public_area: string; post_status: Post['status'];
  counterpart_masked_name: string; counterpart_avatar_url: string | null; can_send: boolean; appointment_id: string | null; server_now: string;
}
export interface ConversationSummary {
  request_id: string; my_role: 'requester' | 'author'; request_status: RequestStatus; post_id: string; post_title: string; post_starts_at: string;
  counterpart_masked_name: string; counterpart_avatar_url: string | null; last_message: string | null; last_message_at: string | null; last_activity_at: string;
}
export interface ChatMessage { id: string; join_request_id: string; sender_id: string; content: string; created_at: string }
export interface AppointmentSummary {
  appointment_id: string; post_id: string; join_request_id: string; my_role: 'author' | 'companion'; status: AppointmentStatus;
  confirmed_at: string; post_title: string; post_starts_at: string; post_ends_at: string; post_public_area: string;
  counterpart_masked_name: string; counterpart_avatar_url: string | null; server_now: string;
}
export type AppointmentStatus = 'confirmed' | 'completed' | 'disputed' | 'no_show' | 'cancelled';
export interface AppointmentState {
  appointment_id: string; join_request_id: string; my_role: 'author' | 'companion'; status: AppointmentStatus;
  confirmed_at: string; completed_at: string | null; completion_method: 'manual' | 'automatic' | null;
  completion_notified_at: string | null; dispute_deadline_at: string | null; completed_by_me: boolean; can_dispute: boolean;
  dispute_status: 'open' | 'resolved' | null; post_id: string; post_title: string; post_starts_at: string; post_ends_at: string;
  post_public_area: string; counterpart_masked_name: string; counterpart_avatar_url: string | null;
  my_completion_at: string | null; peer_completion_at: string | null; can_confirm_completion: boolean; server_now: string;
}
export interface ReviewContent { rating: number; comment: string | null; submitted_at: string }
export interface ReviewState {
  appointment_id: string; appointment_completed: boolean; deadline_at: string | null; hold_until: string | null;
  disputed: boolean; can_write: boolean; own_review: ReviewContent | null; peer_submitted: boolean;
  released: boolean; release_reason: 'mutual' | 'deadline' | null; peer_review: ReviewContent | null; server_now: string;
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  let result;
  try { result = await promise; } catch (error: any) { throw toLiveError(error); }
  if (result.error) throw toLiveError(result.error);
  return result.data as T;
}

const db = (client?: SupabaseClient) => client || getSupabaseClient();

export const liveApi = {
  listPosts: (filters: PostFilters, cursor?: { starts_at: string; id: string }, limit = 20) => unwrap<Post[]>(db().rpc('list_posts', {
    p_query: filters.query.trim() || null, p_date: filters.date || null, p_category: filters.category || null, p_area: filters.area.trim() || null,
    p_after_starts_at: cursor?.starts_at ?? null, p_after_id: cursor?.id ?? null, p_limit: limit,
  })),
  getPost: (id: string) => unwrap<Post | null>(db().from('posts').select('*').eq('id', id).maybeSingle()),
  requestWindow: async (id: string) => (await unwrap<{ accepting_requests: boolean; server_now: string }[]>(db().rpc('post_request_window', { p_post_id: id })))[0] || null,
  myPosts: (userId: string) => unwrap<Post[]>(db().from('posts').select('*').eq('author_id', userId).order('starts_at', { ascending: false })),
  exactLocation: async (postId: string) => (await unwrap<{ exact_location: string }[]>(db().from('post_private_details').select('exact_location').eq('post_id', postId)))[0]?.exact_location ?? null,
  createPost: (args: Record<string, unknown>) => unwrap<Post>(db().rpc('create_post', args)),
  authorProfile: async (postId: string) => (await unwrap<PublicProfile[]>(db().rpc('get_post_author_profile', { p_post_id: postId })))[0],
  counterpartProfile: async (requestId: string) => (await unwrap<PublicProfile[]>(db().rpc('get_request_counterpart_profile', { p_request_id: requestId })))[0],
  createJoinRequest: async (postId: string, message: string) => (await unwrap<{ id: string; status: RequestStatus; already_existed: boolean }[]>(db().rpc('create_join_request', { p_post_id: postId, p_message: message })))[0],
  withdrawJoinRequest: (id: string) => unwrap(db().rpc('withdraw_join_request', { p_request_id: id })),
  declineJoinRequest: (id: string) => unwrap(db().rpc('decline_join_request', { p_request_id: id })),
  sentRequests: () => unwrap<SentRequest[]>(db().rpc('list_sent_join_requests')),
  receivedRequests: () => unwrap<ReceivedRequest[]>(db().rpc('list_received_join_requests')),
  conversations: () => unwrap<ConversationSummary[]>(db().rpc('list_conversations')),
  conversation: async (requestId: string) => (await unwrap<Conversation[]>(db().rpc('get_conversation', { p_request_id: requestId })))[0],
  messages: (requestId: string, before?: ChatMessage, limit = 50) => {
    let query = db().from('chat_messages').select('id,join_request_id,sender_id,content,created_at').eq('join_request_id', requestId);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    return unwrap<ChatMessage[]>(query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit));
  },
  /** Inserts with a client UUID; a PK conflict on retry resolves to the already stored row. */
  sendMessage: async (message: { id: string; join_request_id: string; sender_id: string; content: string }): Promise<ChatMessage> => {
    const { data, error } = await db().from('chat_messages').insert(message).select('id,join_request_id,sender_id,content,created_at').single();
    if (!error) return data as ChatMessage;
    if (error.code === '23505') {
      const stored = await db().from('chat_messages').select('id,join_request_id,sender_id,content,created_at').eq('id', message.id).maybeSingle();
      if (stored.data && stored.data.sender_id === message.sender_id && stored.data.content === message.content) return stored.data as ChatMessage;
    }
    throw toLiveError(error);
  },
  confirmMatch: async (requestId: string) => (await unwrap<{ appointment_id: string; already_confirmed: boolean }[]>(db().rpc('confirm_match', { p_request_id: requestId })))[0],
  appointments: () => unwrap<AppointmentSummary[]>(db().rpc('list_my_appointments')),
  appointmentState: async (id: string) => (await unwrap<AppointmentState[]>(db().rpc('get_appointment_state', { p_appointment_id: id })))[0],
  confirmCompletion: (id: string) => unwrap(db().rpc('confirm_appointment_completion', { p_appointment_id: id })),
  raiseDispute: (id: string, reason: string) => unwrap(db().rpc('raise_appointment_dispute', { p_appointment_id: id, p_reason: reason })),
  reviewState: async (id: string) => (await unwrap<ReviewState[]>(db().rpc('get_appointment_review_state', { p_appointment_id: id })))[0],
  submitReview: async (id: string, rating: number, comment: string) => (await unwrap<ReviewState[]>(db().rpc('submit_appointment_review', { p_appointment_id: id, p_rating: rating, p_comment: comment.trim() || null })))[0],
};
