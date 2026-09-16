// Manual, admin-assisted check (step 1/2): prepares one run-tagged appointment where A reviewed and B only completed.
// Step 2 requires shifting ONLY this post's schedule 8 days back via server-side SQL, then review-deadline-verify.mjs.
import { createContext } from '../helpers/runner.mjs';
import { shortAppointment, waitUntil } from '../helpers/data.mjs';
const ctx = createContext();
const a = await ctx.member('A'); const b = await ctx.member('B');
const target = await shortAppointment(ctx, a, b, '평가기한');
await waitUntil(target.endsAt);
await a.sdk.rpc('confirm_appointment_completion', { p_appointment_id: target.appointmentId });
await b.sdk.rpc('confirm_appointment_completion', { p_appointment_id: target.appointmentId });
const { error } = await a.sdk.rpc('submit_appointment_review', { p_appointment_id: target.appointmentId, p_rating: 5, p_comment: '기한 검증용 한쪽 평가' });
if (error) throw error;
console.log(JSON.stringify({ runId: ctx.run.runId, postId: target.post.post.id, appointmentId: target.appointmentId }));
process.exit(0);
