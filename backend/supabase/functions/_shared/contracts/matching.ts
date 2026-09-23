/** 민규담당. 작성자 제안과 신청자 수락을 구분하고 같은 조건 버전을 확인한다. */
export interface JoinRequestInput { message: string }
export interface MatchAcceptance { conditionVersion: string }
export interface ConversationMessage { messageId: string; content: string }
