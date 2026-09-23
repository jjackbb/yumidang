/** 민규담당. 고정 RPC만 호출하며 사용자 ID·권한 판정은 DB에서 수행한다. */
import type { RpcClient } from "../transport.ts";
export const getOwnProfile = (db: RpcClient) => db.rpc("get_my_profile", {});
export const setProfileAvatar = (db: RpcClient, path: string) => db.rpc("set_my_profile_avatar", { p_avatar_path: path });
