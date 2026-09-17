export type PhotoSignupPhase = 'upload' | 'complete';

export class PhotoSignupFlowError extends Error {
  readonly phase: PhotoSignupPhase;
  readonly original: unknown;

  constructor(phase: PhotoSignupPhase, original: unknown) {
    super(original instanceof Error ? original.message : 'photo_signup_failed');
    this.phase = phase;
    this.original = original;
  }
}

interface PhotoSignupDependencies<TProfile> {
  upload: (blob: Blob) => Promise<string>;
  complete: (avatarPath: string) => Promise<TProfile>;
}

/**
 * Uploads at most once. `onUploaded` lets the UI retain the stable path before the RPC runs,
 * so a failed RPC retry reuses the already uploaded object instead of creating an orphan.
 */
export async function runPhotoSignup<TProfile>(
  blob: Blob,
  reusablePath: string,
  dependencies: PhotoSignupDependencies<TProfile>,
  onUploaded: (path: string) => void,
) {
  let avatarPath = reusablePath;
  if (!avatarPath) {
    try {
      avatarPath = await dependencies.upload(blob);
      onUploaded(avatarPath);
    } catch (error) {
      throw new PhotoSignupFlowError('upload', error);
    }
  }
  try {
    return { profile: await dependencies.complete(avatarPath), avatarPath };
  } catch (error) {
    throw new PhotoSignupFlowError('complete', error);
  }
}
