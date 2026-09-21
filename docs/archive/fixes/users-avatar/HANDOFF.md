# 화면 초기화 오류 수정 — 2026-09-15

## 원인과 변경

초기 예시 데이터의 `usersAvatar('user-req-1')` 호출 대상 함수가 없어서 앱 초기화가 중단됐다. 작업 시작 당시 로컬에는 이미 `requests[0].requesterAvatar`로 바꾼 수정이 있었다. 이 수정을 검증해 배포에 반영했다.

기존 배포 소스에는 MyPageView의 필수 props 누락과 Invitation 객체를 문자열 ID로 취급하는 오류도 있었다. 작업 폴더의 수정 중 필요한 props·핸들러 연결을 배포 사본에 포함했다. `package.json`의 build는 `npm run lint && vite build`로 변경해 정의되지 않은 이름과 타입 오류가 있으면 배포 빌드를 중단한다.

## 배포 범위

- 기준 커밋: `65d77d85452f23f26ac027561de8d40a42646daf`.
- 작업 중인 다른 변경을 통째로 배포하지 않도록 기준 커밋의 별도 사본에 오류 수정만 적용했다. 실제 변경은 [deployed-hotfix.patch](deployed-hotfix.patch)에 보존했다.
- 배포: `dpl_F1j36KZzc91MjCfAiXZggxNFGngv` / `https://yumidang6-rglc1jyou-jjackbb-projects.vercel.app`.
- 새 배포를 먼저 검증한 뒤 `https://yumidang6.vercel.app`로 promote했다. Git commit/push는 수행하지 않았다. 후속 커밋에 현재 로컬 오류 수정과 build 검사를 포함해야 한다.
- 이전 외부 백엔드 스키마·인증 설정·업무 데이터 저장 연동은 이번 수정 범위에 포함되지 않는다.

## 검증

- 수정 사본 TypeScript 검사와 프로덕션 빌드 통과. 기존 큰 JS 번들 경고는 남아 있다.
- 수정 사본 기존 단위 테스트 76개 통과.
- 보호된 배포 주소에서 실제 Chromium으로 홈·둘러보기·미로그인 Me의 로그인 이동·시연 계정 Me·새로고침 확인, pageerror 0건. [기록](deployment-browser.json).
- 운영 주소에서 일반 브라우저로 홈·둘러보기·미로그인 Chat/Me 로그인 이동·시연 계정 Me·새로고침 확인, pageerror 0건. 최종 확인 2026-09-15 15:57 KST. [기록](production-browser.json).
- 시연 계정 확인은 브라우저 로컬 예시 계정 사용이며 실제 이전 외부 백엔드 로그인이나 DB 저장 성공을 의미하지 않는다.
