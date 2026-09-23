/** 민규담당. 고정 RPC만 호출하며 사용자 ID·권한 판정은 DB에서 수행한다. */
import type { RpcClient } from "../transport.ts";
export const listNotifications = (db: RpcClient, limit: number, before: string | null) => db.rpc("list_my_notifications", { p_limit: limit, p_before: before });
export const readNotification = (db: RpcClient, id: string) => db.rpc("mark_my_notification_read", { p_notification_id: id });
export const readAllNotifications = (db: RpcClient) => db.rpc("mark_all_my_notifications_read", {});
