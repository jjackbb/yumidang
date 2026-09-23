/** 민규담당. 제출과 공개는 별도 상태다. 한마디·칭찬은 선택 입력이다. */
export interface ReviewSubmission {
  rating: number;
  experience: "positive" | "neutral" | "negative";
  comment: string | null;
  praises: string[];
}
