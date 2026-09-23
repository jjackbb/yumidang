/** 민규담당. 고정 RPC만 호출하며 사용자 ID·권한 판정은 DB에서 수행한다. */
import type { RpcClient } from "../transport.ts";
export const listAppointments = (db: RpcClient) => db.rpc("list_my_appointments", {});
export const getAppointment = (db: RpcClient, id: string) => db.rpc("get_appointment_state", { p_appointment_id: id });
export const confirmCompletion = (db: RpcClient, id: string) => db.rpc("confirm_appointment_completion", { p_appointment_id: id });
export const processDueCompletions = (db: RpcClient, limit: number) => db.rpc("process_due_completions", { p_limit: limit });
