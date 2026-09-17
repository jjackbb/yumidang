// Run-scoped test data. Every created row carries the run id in its title so it is attributable.
import { randomUUID } from 'node:crypto';

export const DELETED_FIXTURE_POST_ID = '00000000-0000-4000-8000-00000000de1e';
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Creates a post through the public RPC with the member's own session. */
export async function createPost(ctx, member, label, {
  startsInSeconds = 3 * 24 * 3600,
  durationSeconds = 3600,
  recruitmentLeadSeconds = 3600,
  category = '산책',
  publicArea = '서울특별시 성동구 성수동',
  id = randomUUID(),
  partnerGender = 'any',
} = {}) {
  const now = Date.now();
  const startsAt = new Date(now + startsInSeconds * 1000);
  const exactLocation = `하네스 비공개 장소 ${label} ${ctx.run.runId}`;
  ctx.run.guard.protect(exactLocation);
  const args = {
    p_post_id: id,
    p_title: `[${ctx.run.runId}] ${label}`,
    p_description: `하네스 테스트 공고 ${label}`,
    p_category: category,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: new Date(startsAt.getTime() + durationSeconds * 1000).toISOString(),
    p_recruitment_ends_at: new Date(Math.min(startsAt.getTime(), now + recruitmentLeadSeconds * 1000)).toISOString(),
    p_public_area: publicArea,
    p_exact_location: exactLocation,
    p_preference_note: null,
    p_tags: ['하네스'],
    p_partner_gender: partnerGender,
  };
  const { data, error } = await member.sdk.rpc('create_post', args);
  if (error) throw new Error(`create_post failed: ${error.code} ${error.message}`);
  return { post: data, exactLocation, args };
}

export const expectError = (result, label) => {
  if (!result.error) throw new Error(`${label}: expected an error but the request succeeded`);
  return result.error;
};

/** A confirmed appointment whose post ends a few seconds from now (only this run's post schedule is controlled). */
export async function shortAppointment(ctx, author, companion, label, { startsInSeconds = 12, durationSeconds = 8 } = {}) {
  const post = await createPost(ctx, author, label, { startsInSeconds, durationSeconds, recruitmentLeadSeconds: startsInSeconds - 2 });
  const request = await companion.sdk.rpc('create_join_request', { p_post_id: post.post.id, p_message: '하네스 완료·평가 검증용 참여 요청입니다.' }).single();
  if (request.error) throw request.error;
  const match = await author.sdk.rpc('confirm_match', { p_request_id: request.data.id }).single();
  if (match.error) throw match.error;
  return { post, request: request.data, appointmentId: match.data.appointment_id, endsAt: Date.parse(post.post.ends_at) };
}

export const waitUntil = async epochMs => sleep(Math.max(0, epochMs - Date.now()) + 1500);
