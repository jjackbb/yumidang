# 현재 실행 안내 — 2026-09-20

> 현재 기획 기준: [PRD](../../planning/requirements/PRD.md) → [IA](../../planning/design/IA.md) → [유저플로우](../../planning/design/USER_FLOW.md). 성인 여성만 가입·이용하며 동행은 양측이 확정한다. 아래 과거 기록의 남성 가입·S07·성별 필터·작성자 단독 확정 설명은 현재 요구사항으로 사용하지 않는다.

현재 시작점은 [루트 인수인계](../../../HANDOFF.md)다. 오늘은 [폴더 정리·커밋/푸시](../handoffs/REPOSITORY_CLEANUP_2026-09-20.md)를 마무리한다. 팀원 1·2에게는 내일(2026-09-21) 전달해 작업할 예정이며, 이후 목적은 **팀이 합의할 전체 화면 구조 만들기**다. [작업 분담 기준](../work-allocation/README.md)을 따른다.

1. 팀원 1: [정책 재확인·충돌 인수인계](../work-allocation/01_POLICY_HANDOFF.md).
2. 팀원 2: [API 키 발급·연동 인수인계](../work-allocation/02_API_HANDOFF.md).
3. 사용자+현재 GPT/Codex: [현재 IA](../../planning/design/IA.md), [현재 유저플로우](../../planning/design/USER_FLOW.md), [디자인 기준](../../planning/design/DESIGN.md), [기존 Stitch 프롬프트](../../planning/design/STITCH_PROMPTS.md).

정책/API 결과를 화면 설계에 반영한다. 미확정 부분만 대기로 표시하고 독립적인 설계는 계속한다. 코드 적용보다 화면 구조 합의가 현재 작업이다.

## 이전 안내와의 차이

- [01 UT 개선 프롬프트](../../archive/completed-prompts/2026-09-17/01_UT_개선사항_구현_프롬프트_2026-09-17.md)는 완료 보관함으로 이동했다. 새 구현 지시로 실행하지 않는다.
- [02 정책 진행 프롬프트](02_남은_정책_재확인_진행_프롬프트_2026-09-17.md)는 질문 형식 참고다. D-A15·D-A16 등 최신 결정과 담당 구분은 팀원 1 문서를 우선한다.
- 03 발표자료 편집 프롬프트는 기존 작업 트리에서 삭제된 상태다. 복구하거나 현재 작업으로 안내하지 않는다.
- [9월 17일 후속 인수인계](../handoffs/CLAUDE_CODE_UT_개선_후속_인수인계_2026-09-17.md)의 인덱스·commit·push·배포 대기 항목은 [9월 18일 인수인계](../handoffs/CLAUDE_CODE_인수인계_2026-09-18.md)에 완료로 기록돼 있다. 현재 운영 재검증 결과는 아니다.

## 고정 대상

- 저장소: `/Users/b/Documents/Antigravity/yumidang`, `jjackbb/yumidang`, `main`
- Supabase: `bndguguarijmghnkenvt`
- Vercel: `jjackbb-projects/yumidang`
- 2026-09-20 로컬 확인 HEAD: `76a4952`. 이후 구현 재개 시 실제 상태를 다시 확인한다.
- 공용 파일을 동시에 덮어쓰지 않고 각 담당 결과를 통합 담당에게 전달한다. 이미 받은 권한 안에서는 진행하며 새 정책·비용·운영 범위를 자동 확대하지 않는다.
