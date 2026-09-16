/**
 * 실명 마스킹 유틸리티 (유미당 안심 실명제)
 * 예:
 * - 홍길동 -> 홍*동
 * - 김철 -> 김*
 * - 남궁민수 -> 남궁*수
 * - John Doe -> J*** D**
 */
export function maskRealName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;

  if (trimmed.length === 2) {
    return trimmed[0] + '*';
  }

  if (trimmed.length === 3) {
    return trimmed[0] + '*' + trimmed[2];
  }

  if (trimmed.length === 4) {
    return trimmed.slice(0, 2) + '*' + trimmed[3];
  }

  // 5글자 이상
  const first = trimmed.slice(0, 2);
  const last = trimmed.slice(-1);
  const middleStars = '*'.repeat(trimmed.length - 3);
  return first + middleStars + last;
}
