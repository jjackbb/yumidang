# 유미당 (YouMeDang) 🍯

현재 상태 (2026-09-17): React/Vite 화면에 Supabase 사용자 흐름 1~9와 프로필 사진 필수 가입을 연결해 Production에 배포했다. 최신 구현·검증 기준은 [HANDOFF.md](./HANDOFF.md)와 [백엔드 상태](./docs/backend-implementation/STATE.md)이며, 과거 프로토타입 문서는 역사 자료다.

다음 작업은 [현재 실행 프롬프트](./docs/prompts/START_HERE.md)에서 시작한다. 완료된 과거 프롬프트는 `docs/archive/completed-prompts/2026-09-17/`, 정책 원문과 남은 질문은 `docs/product-decisions/`에 분리했다.

> **"너(You)와 나(Me)의 믿을 수 있는 1:1 라이프스타일 동행 매칭 플랫폼"**  
> 취향 맞는 이웃과 함께하는 실시간 1:1 동행 매칭 및 라이프스타일 서비스

![유미당 로고](/public/logo.jpg)

---

## 📌 프로젝트 소개

**유미당**은 혼자 하기 망설여지거나 취향이 통하는 사람과 함께하고 싶을 때, 안전하고 신뢰할 수 있는 이웃과 **1:1로 연결**해 주는 라이프스타일 동행 플랫폼입니다.

- **오직 1:1 동행만 매칭**: 다인원 모임의 부담을 덜고, 나와 상대방 단 둘이서만 만나는 깊이 있는 1대1 매칭(정원 2/2명 고정)을 지향합니다.
- **신뢰 지표 '당도'**: 딱딱한 매너온도 대신 유미당만의 달콤하고 친근한 신뢰 지표인 **당도 (예: 당도 99.2 🍯)**로 상대방의 매너와 동행 만족도를 직관적으로 확인합니다.
- **일상의 12가지 취향 카테고리**: 전시, 축제, 식사, 운동, 여행, 클래스, 산책, 스터디, 공연, 쇼핑, 번개 등 다양한 일상 카테고리를 제공합니다.

---

## 🛠 기술 스택

- **Frontend**: React 19, TypeScript (~5.8)
- **Bundler & Tooling**: Vite 6, ESBuild
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Icons**: Lucide React (`lucide-react`)
- **Typography**: Pretendard Variable Font

---

## 🚀 빠른 시작 (Getting Started)

### 1. 의존성 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
# 기본 3000 포트 실행 (포트 충돌 시 자동으로 다음 포트 연결 또는 npx vite --port=5173 사용)
```

### 3. 프로덕션 빌드 및 타입 검사
```bash
# TypeScript 타입 검사
npm run lint

# 배포용 프로덕션 빌드
npm run build

# 빌드 결과물 로컬 미리보기
npm run preview
```

---

## 📱 주요 화면 및 기능

| 화면 | 주요 기능 |
| :--- | :--- |
| **홈 화면 (Home)** | • 상단 헤더: 유미당 신규 마스코트 로고 및 읽지 않은 알림 카운트<br>• 주목할 이벤트 배너: 시즌 특별 이벤트(서울세계불꽃축제 등) 슬라이드<br>• 매칭 확정 약속 카드: D-Day 카운트다운 및 일정 상세 바로가기<br>• 12가지 카테고리 그리드: 전시, 축제, 식사, 운동 등 원터치 탐색 |
| **둘러보기 (Explore)** | • 내 주변(동네 반경) 1:1 동행 공고 탐색 및 검색<br>• 지역 필터 및 키워드 검색<br>• 1:1 동행 전용 상태 표시 (`1/2명 모집중`, `2/2명 마감`) |
| **1:1 채팅 (Chat)** | • 매칭된 동행 파트너와의 1:1 대화방<br>• 상대방 프로필 요약 (응답률, **당도 99 🍯**)<br>• 약속 정보 바로가기 및 실시간 메시지 전송 |
| **마이페이지 (MyPage)** | • 내 프로필 및 인증회원 뱃지<br>• **유미당 신뢰 지표: 당도 99 🍯 게이지** (기준 당도 50에서 49 상승)<br>• 참여 통계: 참여한 동행(14회), 동행 평점(4.9), 받은 후기(8개)<br>• 진행 예정 동행 요약 카드 및 취향 키워드/안전센터 메뉴 |
| **새 동행 등록 (FAB)** | • 1:1 맞춤 동행 전용 모집 폼 (카테고리, 제목, 일시, 장소, 태그)<br>• **모집 형태 1:1 동행 (나 + 동행 파트너 1명, 2인 정원 고정)** |
| **상세 모달 (Modals)** | • `CategoryDetailModal`: 카테고리별 1:1 공고 리스트 및 즉시 참여 신청<br>• `EventDetailModal`: 대형 이벤트 소개 및 전용 1:1 동행 모임 리스트<br>• `DashboardModal`: 확정 약속 상세(상대 프로필, 추천 메뉴, 상세 주소)<br>• `NotificationModal`: 매칭/이벤트/채팅 알림 및 전체 읽음 처리 |

---

## 📂 프로젝트 구조

기본 저장소는 [jjackbb/yumidang](https://github.com/jjackbb/yumidang)이며, 기본 브랜치는 `main`입니다.
Vercel 배포 설정은 `vercel.json`에 정의되어 있습니다: `npm ci`로 설치한 뒤 `npm run build`를 실행하고 `dist`를 배포합니다.

```
yumidang/
├── public/               # 정적 에셋 (유미당 로고 이미지 등)
│   └── logo.jpg
├── src/
│   ├── assets/           # 소스 에셋 (번들러 참조용)
│   │   └── logo.jpg
│   ├── components/       # UI 컴포넌트
│   │   ├── AppointmentCard.tsx       # 매칭 확정 약속 카드
│   │   ├── BottomNav.tsx             # 하단 내비게이션 바 & FAB (+) 버튼
│   │   ├── CategoryDetailModal.tsx   # 카테고리별 1:1 동행 리스트 모달
│   │   ├── CategoryGrid.tsx          # 12종 카테고리 그리드
│   │   ├── CategoryIcon.tsx          # Lucide 기반 벡터 아이콘 매핑
│   │   ├── ChatView.tsx              # 1:1 동행 채팅 화면 (당도 99.2 표시)
│   │   ├── CreateMeetupModal.tsx     # 새 1:1 동행 등록 모달 (정원 2인 고정)
│   │   ├── DashboardModal.tsx        # 확정 동행 대시보드 모달
│   │   ├── EventBanner.tsx           # 시즌 이벤트 배너
│   │   ├── EventDetailModal.tsx      # 이벤트 상세 및 동행 모임 모달
│   │   ├── ExploreView.tsx           # 내 주변 동행 둘러보기 (1/2명, 2/2명)
│   │   ├── Header.tsx                # 상단 헤더 (새 로고, 알림 종)
│   │   ├── MyPageView.tsx            # 마이페이지 (당도 99.2 지표)
│   │   └── NotificationModal.tsx     # 알림 목록 모달
│   ├── data/
│   │   └── mockData.ts               # 목데이터 (모든 공고 1:1 규격 2인 정원)
│   ├── App.tsx                       # 최상위 앱 컴포넌트 및 상태 관리
│   ├── index.css                     # Tailwind CSS v4 스타일링
│   ├── main.tsx                      # React DOM 루트 마운트
│   ├── types.ts                      # TypeScript 데이터 인터페이스
│   └── vite-env.d.ts                 # Vite 환경 타입 선언
├── index.html            # 웹 진입점 HTML (Pretendard 폰트 & 파비콘)
├── package.json          # 프로젝트 패키지 정의
├── tsconfig.json         # TypeScript 컴파일 설정
└── vite.config.ts        # Vite 설정 (@tailwindcss/vite, alias)
```

---

## 🔐 핵심 서비스 정책

1. **1:1 동행 매칭 원칙**: 모든 모집은 호스트 1인 + 게스트 1인으로 구성되며, 분모는 항상 `2명`으로 엄격히 제한됩니다.
2. **당도 지표**: 상대방과의 만남 평가, 노쇼 여부, 후기를 통해 지속적으로 업데이트되는 신뢰 지수로, 기본 당도 50에서 시작하여 100을 향해 상승합니다.
3. **안심 실명제 & 인증**: 마스킹된 실명 표기(`조*미`, `민*우`) 및 인증회원 뱃지를 통해 안전한 만남 환경을 보장합니다.
