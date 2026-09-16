/** Accept domestic and international formatting for Korean mobile numbers. */
export function normalizeKoreanMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (/^010\d{8}$/.test(compact)) return `+82${compact.slice(1)}`;
  if (/^\+?8210\d{8}$/.test(compact)) return `+${compact.replace(/^\+/, '')}`;
  return null;
}
