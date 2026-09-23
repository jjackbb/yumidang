/** 민규담당. 분리된 검색 주소·만남 상세를 공통 RPC로 전달한다. */
import type { RpcClient } from "../transport.ts";
import type { FreePostInput } from "../../contracts/posts.ts";
export const getPost = (db: RpcClient, id: string) => db.rpc("get_service_post", { p_post_id: id });
export const createPost = (db: RpcClient, id: string, input: FreePostInput) => db.rpc("create_service_post", { p_post_id: id, p_input: { ...input } });
