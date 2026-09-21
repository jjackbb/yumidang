// Browser-only. The original photo (up to 10MB) is decoded but never stored.
export const PROFILE_IMAGE_MAX_EDGE = 480;
export const PROFILE_IMAGE_JPEG_QUALITY = 0.82;

export interface PreparedProfileImage {
  blob: Blob;
  width: number;
  height: number;
}

export function containedImageSize(width: number, height: number, maxEdge = PROFILE_IMAGE_MAX_EDGE) {
  if (width <= 0 || height <= 0 || maxEdge <= 0) throw new Error('invalid_image_dimensions');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Returns an upload blob. The caller separately owns and revokes any preview object URL. */
export function prepareProfileImage(file: File): Promise<PreparedProfileImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const { width, height } = containedImageSize(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas_unavailable');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob || blob.size === 0) { reject(new Error('image_encode_failed')); return; }
          resolve({ blob, width, height });
        }, 'image/jpeg', PROFILE_IMAGE_JPEG_QUALITY);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_decode_failed')); };
    image.src = url;
  });
}
