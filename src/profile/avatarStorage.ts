import { getSupabaseClient } from '../lib/supabase.ts';
import {
  createProfileImagePath,
  isDirectlyRenderableAvatar,
  isOwnProfileImagePath,
  isProfileImagePath,
  PROFILE_IMAGE_BUCKET,
  PROFILE_IMAGE_MAX_STORED_BYTES,
} from './avatarPath.ts';

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const signedUrls = new Map<string, { url: string; expiresAt: number }>();

const cacheKey = (accountId: string, path: string) => `${accountId}:${path}`;

export function clearAvatarUrlCache() {
  signedUrls.clear();
}

export function profileImageErrorMessage(error: unknown, action: 'upload' | 'save' | 'delete' | 'read') {
  const candidate = error as { message?: unknown; statusCode?: unknown; status?: unknown; error?: unknown };
  const message = `${candidate?.message || ''} ${candidate?.error || ''}`.toLowerCase();
  const status = Number(candidate?.statusCode || candidate?.status || 0);
  if (action === 'delete') {
    if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed'))
      return '네트워크 문제로 사진을 삭제하지 못했어요. 기존 프로필 사진은 그대로 유지되며 다시 시도할 수 있어요.';
    if (status === 401 || status === 403 || message.includes('row-level security') || message.includes('permission'))
      return '사진 삭제 권한을 확인하지 못해 삭제되지 않았어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.';
    return '사진을 삭제하지 못했어요. 기존 프로필 사진은 그대로 유지되며 다시 시도할 수 있어요.';
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed'))
    return '네트워크에 연결하지 못했어요. 선택한 사진은 유지되니 연결을 확인하고 다시 시도해 주세요.';
  if (status === 401 || status === 403 || message.includes('row-level security') || message.includes('permission'))
    return '사진 저장 권한을 확인하지 못했어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.';
  if (message.includes('profile_image_missing') || message.includes('profile_image_not_owned') || message.includes('invalid_profile_image'))
    return '업로드된 사진을 서버가 확인하지 못했어요. 사진을 다시 선택해 주세요.';
  if (action === 'upload') return '사진 업로드에 실패했어요. 선택한 사진은 유지되니 다시 시도해 주세요.';
  if (action === 'read') return '저장된 사진을 불러오지 못했어요.';
  return '사진 경로를 프로필에 저장하지 못했어요. 업로드된 사진을 그대로 사용해 다시 시도할 수 있어요.';
}

async function authenticatedUserId() {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('login_required');
  return data.user.id;
}

export interface ProfileImageUploadDependencies {
  authenticatedUserId: () => Promise<string>;
  upload: (path: string, blob: Blob) => Promise<void>;
  createPath?: (userId: string) => string;
}

const defaultUploadDependencies: ProfileImageUploadDependencies = {
  authenticatedUserId,
  upload: async (path, blob) => {
    const { error } = await getSupabaseClient().storage.from(PROFILE_IMAGE_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
    });
    if (error) throw error;
  },
};

export async function uploadProfileImage(
  blob: Blob,
  reusablePath?: string | null,
  dependencies: ProfileImageUploadDependencies = defaultUploadDependencies,
) {
  if (blob.type !== 'image/jpeg' || blob.size <= 0 || blob.size > PROFILE_IMAGE_MAX_STORED_BYTES)
    throw new Error('invalid_resized_profile_image');
  const userId = await dependencies.authenticatedUserId();
  const validReusablePath = reusablePath && isOwnProfileImagePath(reusablePath, userId) ? reusablePath : null;
  if (validReusablePath) return validReusablePath;
  const path = dependencies.createPath?.(userId) ?? createProfileImagePath(userId);
  await dependencies.upload(path, blob);
  return path;
}

export async function removeOwnProfileImage(path: string | null | undefined) {
  if (!path) return;
  const userId = await authenticatedUserId();
  if (!isOwnProfileImagePath(path, userId)) return;
  const { error } = await getSupabaseClient().storage.from(PROFILE_IMAGE_BUCKET).remove([path]);
  if (error) throw error;
  signedUrls.delete(cacheKey(userId, path));
}

export async function resolveProfileAvatar(value: string | null | undefined, accountId: string) {
  if (!value) return '';
  if (isDirectlyRenderableAvatar(value)) return value;
  if (!isProfileImagePath(value)) return value;
  const key = cacheKey(accountId, value);
  const cached = signedUrls.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;
  const { data, error } = await getSupabaseClient().storage.from(PROFILE_IMAGE_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  signedUrls.set(key, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

type AvatarRpcRow = { avatar_url: string | null; previous_avatar_path: string | null };
const firstRpcRow = (data: unknown) => (Array.isArray(data) ? data[0] : data) as AvatarRpcRow | null;

export async function commitMyProfileImage(path: string) {
  const { data, error } = await getSupabaseClient().rpc('set_my_profile_avatar', { p_avatar_path: path });
  if (error) throw error;
  const result = firstRpcRow(data);
  if (!result?.avatar_url) throw new Error('missing_profile_avatar_result');
  if (result.previous_avatar_path && result.previous_avatar_path !== path && isProfileImagePath(result.previous_avatar_path)) {
    try { await removeOwnProfileImage(result.previous_avatar_path); } catch { /* DB already points to the new image; cleanup is retryable. */ }
  }
  clearAvatarUrlCache();
  return result.avatar_url;
}

export type ProfileImageCleanupStatus = 'not-needed' | 'deleted' | 'failed';
export interface ClearProfileImageDependencies {
  clearProfileAvatar: () => Promise<AvatarRpcRow | null>;
  removeOwn: (path: string) => Promise<void>;
}

const defaultClearDependencies: ClearProfileImageDependencies = {
  clearProfileAvatar: async () => {
    const { data, error } = await getSupabaseClient().rpc('clear_my_profile_avatar');
    if (error) throw error;
    return firstRpcRow(data);
  },
  removeOwn: removeOwnProfileImage,
};

export function profileImageDeleteNotice(cleanup: ProfileImageCleanupStatus) {
  return cleanup === 'failed'
    ? '프로필 사진은 삭제됐지만 이전 저장 파일 정리만 지연됐어요. 프로필에는 더 이상 표시되지 않아요.'
    : '사진을 삭제했어요. 프로필 사진은 필수라 새 사진을 등록해 주세요.';
}

export async function clearMyProfileImage(dependencies: ClearProfileImageDependencies = defaultClearDependencies) {
  const result = await dependencies.clearProfileAvatar();
  let cleanup: ProfileImageCleanupStatus = 'not-needed';
  if (result?.previous_avatar_path && isProfileImagePath(result.previous_avatar_path)) {
    try {
      await dependencies.removeOwn(result.previous_avatar_path);
      cleanup = 'deleted';
    } catch {
      cleanup = 'failed';
    }
  }
  clearAvatarUrlCache();
  return { cleanup, previousAvatarPath: result?.previous_avatar_path ?? null };
}
