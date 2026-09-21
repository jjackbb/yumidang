/**
 * Real-name masking shared with the server rule `public.mask_real_name`.
 * - 변종 -> 변*
 * - 변종현 -> 변*현
 * - 변종현미 -> 변**미
 * The browser uses this only for the member's own preview; other members' names arrive already masked.
 */
export function maskRealName(name: string): string {
  const chars = [...(name || '').trim()];
  if (chars.length === 0) return '';
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
