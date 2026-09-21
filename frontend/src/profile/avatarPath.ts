export const PROFILE_IMAGE_BUCKET = 'profile-images';
export const PROFILE_IMAGE_MAX_STORED_BYTES = 2 * 1024 * 1024;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PROFILE_IMAGE_PATH = new RegExp(`^(${UUID})/(${UUID})\\.jpg$`, 'i');

export function isProfileImagePath(value: string | null | undefined): value is string {
  return Boolean(value && PROFILE_IMAGE_PATH.test(value));
}

export function isOwnProfileImagePath(value: string | null | undefined, userId: string) {
  const match = value?.match(PROFILE_IMAGE_PATH);
  return Boolean(match && match[1].toLowerCase() === userId.toLowerCase());
}

export function createProfileImagePath(userId: string, objectId = crypto.randomUUID()) {
  const path = `${userId}/${objectId}.jpg`;
  if (!isOwnProfileImagePath(path, userId)) throw new Error('invalid_profile_image_path');
  return path;
}

/** Existing absolute/data/blob values stay readable during migration; private object paths never become raw img src values. */
export function isDirectlyRenderableAvatar(value: string | null | undefined): value is string {
  return Boolean(value && /^(https?:|data:image\/|blob:)/i.test(value));
}
