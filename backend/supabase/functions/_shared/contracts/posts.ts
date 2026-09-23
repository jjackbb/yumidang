/** 민규담당. 신규 무료 공고. 유료 쓰기는 계좌 공급사 연동 전 제공하지 않는다. */
export interface FreePostInput {
  title: string; description: string; category: string;
  startsAt: string; endsAt: string; recruitmentEndsAt: string;
  publicArea: string; registeredPlaceName: string | null;
  registeredAddress: string; meetingDetail: string;
  preferenceNote: string | null; tags: string[];
  costType: "free"; amount: 0;
}
