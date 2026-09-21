# Google Stitch 화면별 프롬프트 — 유미당 UX/UI 교체

작성: 2026-09-18 · 기준 코드: `76a4952` (Production 배포본)

## 사용법

1. Stitch에서 **Mobile** 모드로 새 프로젝트를 만든다.
2. 첫 프롬프트로 `docs/planning/design/DESIGN.md` 전체를 붙여 넣고 끝에 한 줄을 붙인다: `Use this as the design system for every screen in this project. Reply "OK" only.`
3. 아래 화면 프롬프트를 **한 번에 하나씩** 넣는다. 영어 지시 + 한국어 UI 문구로 작성했다(Stitch는 영어 지시를 더 정확히 따른다). **따옴표 안 한국어 문구는 바꾸지 말 것.**
4. 마음에 들 때까지 수정 요청은 짧게 한다. 예: `Make the filter area more compact`, `Increase spacing between cards`.
5. 완성되면 화면 이름(예: `S01_둘러보기.png`)으로 스크린샷과 HTML/코드를 내보내 `docs/planning/design/stitch-export/`에 넣는다 → Antigravity 적용 단계로 넘긴다.

## 공통 규칙 (모든 프롬프트에 이미 반영됨)

- 폭 440px 이하 모바일, 좌우 20px 여백, 하단 탭(홈/둘러보기/채팅/나)과 보라색 + 버튼은 홈과 동일하게 유지.
- 데이터는 **예시 값**으로 채우되 실제 사람 이름·전화번호를 쓰지 않는다. 이름은 항상 마스킹(`김*연`), 나이는 "만" 없이 `25세`, 당도는 `15당`(기본값) 형식.
- 기능을 **추가하지 않는다.** 목록에 없는 버튼(좋아요, 공유 수, 평점 통계 등)을 만들지 않는다.
- "보존 문구"는 표현을 다듬어도 **의미는 그대로** 있어야 한다.

## 진행 순서

| 차수 | 화면 | 조건 |
|---|---|---|
| 1차 | S01~S09-3 | 정책 영향 거의 없음 → 바로 진행 |
| 2차 | S10~S15-2 | 정책 영향 적음 |
| 3차 | S16~S19 | **정책 결정(완료·분쟁·평가·취소) 이후** 진행 |
| 보류 | 신고·차단·KYC·유료 결제·안심 통화·초대/관심친구 | 실서비스에서 동작하지 않는 기능. **보일지 숨길지 제품 결정 먼저** |

---

# 1차

## S01 둘러보기 (탭)

```text
Design the "둘러보기" (Explore) tab screen of the 유미당 mobile app, following the design system. Keep the same sticky header (logo + bell) and bottom tab bar with "둘러보기" active, and the violet + FAB.

Goal: let users quickly narrow companion posts and scan results. The current version is cluttered — make the filter area compact and the result cards easy to scan.

Content, top to bottom:
1. Title "동행 둘러보기", subtitle "카테고리·지역·날짜로 모집 공고를 찾아보세요."
2. Search field, placeholder "제목, 장소, 태그 검색"
3. Horizontal scroll category chips: 전체, 지금, 전시, 축제, 식사, 운동, 여행, 클래스, 산책, 스터디, 공연, 쇼핑, 기타 (one selected)
4. Filter row (compact dropdowns or a "필터" bottom-sheet trigger — your choice, but all options must exist):
   - 지역: 전체 지역 / 성동구·성수 / 강남구 / 종로구 / 영등포구·여의도 / 서초구·반포
   - 날짜: 전체 날짜 / 오늘 / 7일 이내 / 날짜 지정 (shows a date picker)
   - 작성자 성별: 전체 / 여성 / 남성 (logged-in users only)
   - 작성자 연령대: 전체 / 20대 / 30대 / 40대 이상 (logged-in users only)
   - Small note under demographic filters: "검색 편의를 위한 필터이며, 공고의 신청 가능 조건과는 별개예요."
5. Result bar: applied-filter summary (e.g. "적용: 전시 · 종로구"), "검색 결과 3건", text button "필터 초기화"
6. Result card list. Each card: category badge, optional "행사 동행" badge, status badge "1/2명 (모집중)" or "모집 마감", title (max 2 lines), schedule "9월 20일 (토) 14:00–16:00" (KST), place "종로구 삼청동", author avatar + masked name "김*연", author gender·age "여성 · 27세" (logged-in only), sweetness "15당", link "상세보기 >".

Also show (as a second artboard) the empty state: "조건에 맞는 공고가 없어요", "필터를 줄이거나 초기화해 보세요.", buttons [필터 초기화] [홈으로 돌아가기].

Do not add likes, view counts, maps, or sorting options that are not listed.
```

## S02 공고 상세 (바텀시트/전체 화면 모달)

```text
Design the post detail screen ("공고 상세") as a full-height bottom sheet with a close button, following the design system.

Content, top to bottom:
1. Badges: category "전시", status "1/2명 (모집중)" (other variants: "모집 마감", "기간 만료"). Small line: "모집 마감 9월 19일 (금) 22:00".
2. Title (large, bold).
3. Author card (tappable → profile): avatar, masked name "김*연", "호스트" badge, "15당", "휴대폰 인증", gender·age "여성 · 27세" (logged-in only), one-line intro.
4. Section "동행 소개": description text (empty fallback "아직 등록된 상세 소개가 없어요.").
5. Info list with icons: 일정 "9월 20일 (토) 14:00–16:00", 공개 만남 지역 "서울특별시 종로구 삼청동", 상대 조건 "성별 무관" (or 여성만/남성만), 연결 행사 (optional).
6. Private place block — IMPORTANT safety rule, make it visually clear but calm:
   - Locked (default): lock icon, "상세 만남 장소는 1:1 매칭 확정 후 공개됩니다", badge "비공개 🔒".
   - Unlocked variant (author or matched partner only): "매칭 확정자 전용 상세 장소" + address.
7. "파트너에게 바라는 점" (optional) and tag chips.
8. Sticky bottom action area with ONE primary button depending on state:
   - Can apply: "1:1 동행 참여 신청하기"
   - Already has chat: "연결된 대화방으로 이동"
   - Not eligible: disabled "신청 조건에 맞지 않아요" + reason text below
   - Closed/expired: disabled button with label "모집 마감" / "기간 만료"

Produce 3 artboards: (A) guest/requester who can apply with locked place, (B) not eligible, (C) author view: notice "내가 등록한 1:1 동행 공고입니다", unlocked place, secondary buttons [공고 수정] [모집 조기 마감] and a destructive text button [공고 삭제하기].
Also a small dialog variant for a deleted post: "삭제된 공고예요" / "새 신청은 할 수 없어요. Me와 채팅에서 이전 신청과 대화 기록은 확인할 수 있습니다."
```

## S03 공고 작성 1단계 — 이벤트 정보

> 와이어프레임 v4 `post-create-1` + 사용자 결정 D-A1(카테고리 필수)·D-A2(주소 검색)·D-A3(아이폰 캘린더식 일정 입력)·D-A5(태그 유지).

```text
Design step 1 of 2 of the "동행 공고 만들기" (create post) flow as a full-screen page, following the design system. No bottom tab bar.

Top area:
- Top bar: back/close, title "동행 공고 만들기"
- A step progress bar pinned at the top that shows "1 / 2" (first half filled). It stays visible while the form scrolls.
- Heading "무엇을 함께하고 싶나요?"

Form, grouped into cards like the iPhone Calendar "New Event" sheet (inset grouped rows, thin dividers):

Group 1 — 기본 정보
1. 카테고리 (required): 12 selectable chips — 지금, 전시, 축제, 식사, 운동, 여행, 클래스, 산책, 스터디, 공연, 쇼핑, 기타
2. 제목 (required, max 80 chars), placeholder "예: 불꽃 잘 보이는 곳에서 함께 봐요"
3. 내용 (required, multiline), placeholder "함께하고 싶은 활동과 분위기를 적어 주세요"
4. 태그 (optional): chip input, type and press space/enter to add chips (e.g. #불꽃 #사진), [x] on each chip

Group 2 — 장소 (required), works like entering a delivery address:
- Row with magnifier icon, placeholder "장소나 주소를 검색하세요" (주소는 카카오 우편번호 팝업, 장소명은 카카오 로컬 검색)
- Tapping opens a search sheet (separate artboard): search input, result list mixing places and addresses (each row: place name or 도로명 주소 bold, 지번 주소 gray, category/postal code small), tap to select.
- After selecting: selected place card (e.g. "여의도 한강공원 · 서울 영등포구 여의동로 330") + "상세 위치" input (e.g. "3번 출구 앞") + small [변경].
- Helper with globe + lock icons: "공고에는 시·구·동까지만 공개돼요. 정확한 주소는 매칭이 확정된 상대에게만 보여요."

Group 3 — 이벤트 (optional):
- Row "이벤트" with value "선택 안 함 >" that opens a bottom sheet of real events (thumbnail, category 팝업/전시/축제/공연, title, period, status 진행중/예정). Ended events disabled with "종료".
- After selecting: event mini card with [x] to clear. Helper: "이벤트를 선택하면 해당 행사 상세의 동행 목록에도 보여요."

Group 4 — 일정, exactly like iPhone Calendar:
- Row "시작" with value pills on the right: date pill "2026년 9월 19일 (토)" and time pill "오후 6:00"
- Row "종료" with the same pills "오후 9:00"
- Tapping a date pill expands an inline month calendar under the row; tapping a time pill expands an inline wheel time picker (오전/오후, 시, 분 in 5-min steps). Only one picker open at a time; the active pill is highlighted in violet.
- When start changes, end moves together keeping the same duration.
- Error style: end pill shown with red strikethrough text + message "종료 시각은 시작 시각보다 늦어야 해요."
- Row "모집 마감" with pills (default = same as start). Helper: "현재 이후, 시작 시각 이전으로 정할 수 있어요."

Sticky bottom: primary button [다음] (full width). Inline error summary above it when invalid.

Artboards: (A) empty form, (B) filled form, (C) start time wheel open, (D) start date calendar open, (E) place search sheet, (F) event select sheet.
Do not add price, PRO, headcount, or payment fields.
```

## S04 공고 작성 2단계 — 상대 조건

> 와이어프레임 v4 `post-create-2` + 사용자 결정 D-A4(나이 범위 슬라이더)·D-A5(파트너에게 바라는 점 유지).

```text
Design step 2 of 2 of the "동행 공고 만들기" flow, same layout as step 1.

Top area:
- Top bar: back (returns to step 1 with all inputs kept), title "동행 공고 만들기"
- Step progress bar at top showing "2 / 2" (fully filled)
- Heading "어떤 동행이면 좋을까요?"

Fields:
1. 성별: segmented options 상관없음 / 남성 / 여성 (default 상관없음)
2. 나이: a range selector
   - Large live label above the bar: "23세 ~ 42세" (updates instantly while dragging)
   - Horizontal range slider with two thumbs, track from 18세 to 120세; the selected range filled in violet; small value bubbles above each thumb while dragging
   - Below the slider: two small numeric inputs "최소 23" "최대 42" with keyboard input (number pad); editing them moves the thumbs
   - Text button "나이 제한 없음" that resets to the full range
   - Helper: "만 나이 기준이에요. 이 범위에 맞는 회원만 신청할 수 있어요."
3. 파트너에게 바라는 점 (optional, multiline), placeholder "예: 사진 찍는 걸 좋아하는 분이면 좋겠어요"
4. Summary card of step 1 (read-only, compact): category, title, date/time, 시·구·동 area, selected event — with a text link [1단계 수정].

Sticky bottom: [이전] secondary + [완료] primary (loading label "등록 중…").
Artboards: (A) default, (B) dragging the left thumb with bubble "23세", (C) keyboard input state.
Also show the close-confirmation dialog: "작성 중인 내용을 삭제할까요?" [계속 작성] [삭제하고 닫기].
```

## S05 로그인·가입 ① 약관 + 휴대폰 인증

```text
Design the first part of the sign-up / login flow as a full-screen sheet, following the design system. Header: close (X), title "회원가입" (or "로그인"), step indicator "1/4".

Artboard A — 약관 동의 (sign-up only):
- Big "전체 동의" checkbox row
- 4 required checkbox rows (each with a ">" to view): "[필수] 만 19세 이상 확인", "[필수] 서비스 이용약관 동의", "[필수] 개인정보 수집 및 이용 동의", "[필수] 1:1 동행 안전 수칙 확인"
- Small gray note: "현재 약관 화면은 가입 흐름 확인용이며, 법률 검토된 영구 동의 이력을 저장하는 기능은 아직 포함하지 않았어요."
- Primary [동의하고 다음으로] (disabled until all checked), text link [로그인으로 돌아가기]

Artboard B — 휴대폰 인증 (step "2/4"):
- Title "휴대폰 번호로 시작해요"
- Phone input "010-0000-0000" + button [인증번호 요청] (after request: [재요청])
- 6-digit code input + countdown "02:59"
- Info box: "테스트 계정과 인증값은 별도 운영 안내에서 확인해 주세요. 화면에는 전화번호나 인증값을 노출하지 않아요."
- Primary [인증하고 가입 계속하기] (login mode label: [인증하고 로그인])
- Link to switch: "이미 계정이 있나요? 로그인" / "처음이신가요? 회원가입"
- Error banner style (red) example: "인증번호가 맞지 않아요."

Never display a real phone number or code value in the design.
```

## S06 로그인·가입 ② 기본 프로필

```text
Design the "기본 프로필" step (step "3/4") of sign-up, following the design system. Personal-info privacy must feel trustworthy.

Fields:
1. 프로필 사진 (required): large circular placeholder with camera icon, button [사진 선택], helper "JPG·JPEG·PNG, 원본 10MB 이하. 긴 변 480px JPEG로 줄여 비공개 저장소에 올려요."
2. 실명 (required, Korean 2–20 chars), helper: "원본 실명은 본인만 볼 수 있고, 다른 회원에게는 김*연처럼만 보여요. 신분증 확인이나 실명 인증은 아니에요."
3. 성별 (required): two large toggle buttons 여성 / 남성, helper "가입 후 로그인 회원에게 공고 상세에서만 표시돼요"
   - If 여성 selected: note "여성 회원은 기본정보 입력 후 바로 가입할 수 있어요."
   - If 남성 selected: note "여성회원 추천 코드 또는 학교·직장 이메일 확인이 필요해요."
4. 생년월일 (required, 만 19세 이상), shows computed "27세", helper "원본 생년월일은 본인만 조회하며, 다른 회원에게는 나이(만 나이 기준)만 표시해요."

Sticky bottom primary button: female → [사진과 기본 프로필 저장하고 가입 완료], male → [다음: 가입 조건 확인].
Show 2 artboards: female selected (filled), male selected.
```

## S07 로그인·가입 ③ 남성 가입 조건 + 완료

```text
Design the last sign-up screens, following the design system.

Artboard A — 가입 조건 확인 (male only, step "4/4"):
- Title "가입 조건을 확인해 주세요"
- Segmented choice: [여성 회원 추천] / [학교·직장 이메일]
- Option 추천: code input with format hint "YMD-XXXXXXXX", helper "가입을 완료한 여성 회원의 한 코드를 여러 번 사용할 수 있어요."
- Option 이메일 (second artboard): email input "학교 또는 직장 이메일", button [코드 요청], 6-digit code input, button [이메일 확인], gray note "유저테스트용 인증입니다. 실제 이메일은 발송되지 않아요. 요청 후 10분 동안만 유효해요."
- Primary [조건 확인하고 가입 완료], text button [기본 정보로 돌아가기]

Artboard B — 가입 완료:
- Large check icon, "회원가입이 완료됐어요."
- Summary card: avatar, "김*연 · 27세"
- Primary [유미당 시작하기]

Do not show the fixed test code value in the UI.
```

## S08 1:1 동행 참여 신청

```text
Design the "동행 참여 신청" bottom sheet, following the design system.

Content:
1. Target post summary card: category badge, author "김*연 · 15당", title, schedule, public area.
2. Optional warning box (amber): "일정 중복 주의" + list of overlapping confirmed appointments (title + time).
3. "호스트에게 전달되는 내 프로필" mini card: my avatar, masked name, sweetness.
4. 소개 메시지 (required, multiline), prefilled: "안녕하세요! 공고 내용 확인하고 취향이 잘 맞을 것 같아 신청드립니다. 약속 시간 철저히 지키겠습니다 :)"
5. Info box "신청 후 흐름": "신청하면 바로 작성자와 대화할 수 있어요. 작성자가 수락하면 동행이 확정돼요. 확정 전에는 신청을 취소할 수 있어요."
6. Sticky primary button [동행 신청하기].

Also the schedule-conflict confirm dialog: title "겹치는 확정 일정이 있어요", list of appointments, note "기존 약속이 자동으로 취소되지는 않아요.", buttons [돌아가서 확인] [확인했어요·계속 진행].
```

## S09 카테고리 동행 목록

```text
Design the category post list screen, following the design system. Reuse the same post card as the Explore screen for consistency.

- Top bar: back, category icon + "전시 동행", text button [모집하기]
- Intro: badge "1:1 취향 동행", heading "취향 맞는 이웃과 함께하는 전시"
- Search field, "검색 결과 4건", toggle "모집중만 보기"
- Post cards (category, status "1/2명 (모집중)", title, time·place, tags, author + sweetness, button [동행 신청하기] or disabled "모집 마감")
- Sticky bottom primary [이 카테고리로 1:1 동행 모집하기]
- Empty state artboard: "등록된 전시 동행이 없습니다." / "직접 첫 번째 1:1 동행을 제안해보세요!" + [동행 모집 글 올리기]
  (The "지금" category title is "지금이당!")
```

## S09-2 행사 전체보기

> 진입: **홈 이벤트 배너 우측 상단 "전체보기"**. 와이어프레임 v4 `events` 화면 전체를 포함하고, **기간 선택만 현재 앱 방식(월 이동 + 주차 탭)** 을 유지한다.

```text
Design the "행사 전체보기" screen, following the design system. It opens when the user taps "전체보기 >" at the top-right of the home event banner. Bottom tab bar visible (둘러보기 active) with the violet + FAB.

Content, top to bottom:
1. Top bar: back, title "이번 주의 행사"
2. Page heading: small kicker "WEEKLY DISCOVERY", title "이번 주, 어디로 갈까요?", subtitle "종료된 행사도 정보와 지난 동행을 확인할 수 있어요."
3. Period selector (keep this exact pattern):
   - Month switcher "‹ 2026년 9월 ›"
   - Week tabs in a row: 1주차 / 2주차 / 3주차 / 4주차 / 5주차 (one active)
   - Line: "9월 3주차에 시작하는 행사 · 4개"
4. Category filter chips — only these four: 팝업 / 전시 / 축제 / 공연 (no "전체" chip; when none is selected, all events show; tap an active chip again to clear)
   - When 공연 is selected, sub-genre chips expand right after it: 콘서트 / 뮤지컬 / 연극 (one active); they collapse when another category is chosen.
5. Result area:
   a. No chip or 팝업/전시/축제 → vertical event list. Each row: thumbnail image on the left, status badge (진행중 / 이번 주 시작 / 운영 등록 / 종료, or category name), title, meta "9월 3주차 · 여의도", small gray line "출처와 마지막 갱신 시각 표시". Ended events look muted/grayscale.
      Example rows: 서울세계불꽃축제 (진행중, 여의도) / 뮤지컬 라이프 오브 파이 (이번 주 시작, GS아트센터) / 성수 디자인 위크 (운영 등록, 성수) / 한강 여름밤 영화제 (종료, 반포)
   b. 공연 selected → header "뮤지컬 Top 10" with source note "KOPIS 예매상황판 기준 · 직전 완료 주 09.07~09.13 · 순위 숫자 미표시", then 10 event rows WITHOUT rank numbers (meta "공연 기간·장소 · 상세에서 출처 확인").
6. Footer source note: "행사 정보 출처: KOPIS 공연예술통합전산망 외 · 2026.09.18 09:00 갱신"
7. Empty state: "이 주차에 시작하는 행사가 없어요."

Artboards: (A) no chip selected, (B) 공연 > 뮤지컬 Top 10 expanded, (C) empty week.
Tapping any row opens 행사 상세.
```

## S09-3 행사 상세

> 와이어프레임 v4 `event-detail` 그대로.

```text
Design the "행사 상세" screen, following the design system. No bottom tab bar; light gray page background with white cards.

1. Top bar: back (to 행사 전체보기), title "행사 상세"
2. Hero image area with overlay: badge "시즌 이벤트", title "2026 서울세계불꽃축제"
3. Card "행사 정보": meta rows with icons — 기간 "2026.09.18 ~ 09.20", 장소 "서울 영등포구 여의도 한강공원", 요금 "무료 · 일부 프로그램 별도"
   Warning note (amber, calm): "회차와 실제 구매 가능한 좌석은 공식 예매처에서 다시 확인해 주세요."
4. Card "출처": "KOPIS 공연예술통합전산망 · 2026.09.18 09:00 갱신" + text link "공식 행사 정보 보기 ↗"
5. Section "이 행사를 함께할 동행" + count badge "2개": post cards
   - "불꽃 잘 보이는 곳에서 함께 봐요" · 축제 · 9월 19일 · 여의도 · 작성자 사진 + 이름
   - "사진 찍으며 천천히 즐길 분" · 축제 · 9월 20일 · 여의도
   Empty: "아직 이 행사로 만든 동행이 없어요."
6. Sticky bottom actions: [공식 정보] secondary + [이 행사로 동행 만들기] primary
   Ended-event variant: primary disabled, note "종료된 행사라 새 동행을 모집할 수 없어요. 행사 정보와 기존 공고는 계속 볼 수 있어요."

Artboards: (A) ongoing event with 2 posts, (B) ended event.
```

---

# 2차

## S10 채팅 목록 (탭)

```text
Design the "채팅" tab list screen, following the design system. Bottom tab "채팅" active. No FAB on chat screens.

- Title "동행 채팅" + short subtitle
- Room rows: partner avatar, masked name, status badge (e.g. "매칭 중·확정 전", "매칭 확정", "신청 취소", "모집 마감으로 종료"), linked post title (1 line, gray), last message preview, time, unread dot. Sorted by latest message.
- Ended rooms look muted but still readable.
Artboards: (A) list, (B) empty "아직 연결된 대화가 없어요. 관심 있는 공고에 동행을 신청해 보세요.", (C) guest "로그인하고 동행 대화를 확인하세요" + [로그인].
```

## S11 채팅방

```text
Design the 1:1 chat room screen, following the design system. This is the most complex screen — prioritize clarity of "what state are we in and what should I do next".

Top bar: back, partner avatar + masked name "김*연", "15당", gender·age, link "프로필 보기". If confirmed: small phone button labeled "안심 통화 · 준비 중" (disabled look).

Context bar under top bar: status label + linked post title (tappable) + (if confirmed) link "약속 상세 →".
Status labels: 매칭 중·확정 전 / 변경 조건 확인 필요 / 매칭 확정 / 신청 거절 / 신청 취소 / 다른 동행자와 확정 / 모집 마감으로 종료 / 모집 기간 만료 / 공고 삭제로 종료 / 변경 조건 거절 / 확정 동행 취소

Action panel (pinned under context bar, collapsible):
- Host + pending: [거절] [동행 수락하기]
- Requester + pending: "작성자가 수락하면 동행이 확정돼요." + text button [신청 취소]
- Confirmed: text button "확정 동행 취소"

Messages: centered system messages, my bubbles right (violet), partner bubbles left (white/gray), time stamps. A schedule-change proposal card inside the chat: "일정·장소 변경 제안", new date/time + place, status (대기 / 수락됨 / 거절됨·기존 일정 유지 / 취소됨), buttons [거절] [수락].

Composer:
- Greeting suggestion chips (3), e.g. "안녕하세요! 공고 보고 연락드렸어요." — tapping only fills the input, it does NOT send. Show a tiny hint "누르면 입력창에 채워져요".
- Input + send button. If confirmed: calendar icon button to propose a schedule change.
- Disabled composer variant: "신청 취소 · 이전 대화는 볼 수 있지만 새 메시지는 보낼 수 없어요."

Artboards: (A) requester, pending, with greeting chips, (B) host, pending, (C) confirmed with proposal card, (D) ended (disabled composer).
```

## S12 알림

```text
Design the notifications screen (full-height sheet), following the design system.

- Header: title "알림", text button [모두 읽음], close.
- Filter chips: 전체 / 초대·관심친구 / 신청·동행 / 대화 / 행사
- Notification rows: type icon with soft colored circle, title, time, description, optional link "내용 확인하기 >".
- Unread rows: light violet background + bold title. Read rows: white + gray text.
- Example items: "새 동행 신청이 도착했어요" (신청·동행), "김*연님이 신청을 수락했어요", "새 메시지가 있어요".
Artboards: list with mixed unread/read, and empty "이 종류의 알림이 없어요."
```

## S13 마이 (나 탭)

```text
Design the "나" (My page) tab, following the design system. Bottom tab "나" active. The current page is an overly long stack of panels — reorganize into a clear hierarchy with sections/tabs, but keep every listed item reachable.

1. Profile header: avatar (tap to change photo, camera badge), masked name, verification badge "휴대폰 인증", area·age "25세", sweetness gauge "15당" and accordion "당도는 어떤 정보인가요?" (content: "가입하면 15당에서 시작해요."), buttons [프로필 편집] [공개 프로필 미리보기], logout icon.
   Below the header: chips for 취향과 활동, 대화 방식, MBTI (e.g. 전시 · 산책 · 조용한 대화 · ISFJ) with a small [수정] link.
2. Quick stats (3): 참여한 동행 N회 / 동행 평점 — / 받은 후기 N개
3. (Female members only) "내 추천 코드" card: code "YMD-A1B2C3D4" + [복사], note "가입을 완료한 여성 회원에게만 발급되며, 여러 명이 반복해서 사용할 수 있어요."
4. "나의 동행" with tabs [신청한 동행 N] [받은 신청 N]. Request card: status badge, requested time (KST), post title, counterpart avatar/name (+ sweetness, age on received), message, buttons:
   - Sent + pending: [대화하기] [신청 취소]
   - Received + pending: [거절] [수락하기], note "대화 없이 바로 수락할 수도 있어요. 수락하면 이 공고의 다른 신청은 종료돼요."
   - Empty: "아직 신청한 동행이 없어요." / "아직 받은 신청이 없어요."
5. "내가 쓴 공고": count, rows (title, status, time, "확정 전 신청 N건")
6. "상태별 동행" tabs [확정 N] [완료 N] [취소 N]: card with status, time, title, partner link, completion/review summary, [약속 상세] [대화방]. Empty texts: "확정된 동행이 없어요." etc.
7. "받은 후기" section: review list (reviewer, date, stars, comment) or "아직 공개된 동행 후기가 없어요."
8. "안전·계정" menu rows: 안전 수칙, 신고 처리·이의제기, 회원 탈퇴 (rows only).

Guest artboard: "로그인이 필요한 서비스입니다" + [휴대폰 본인인증으로 시작하기].
Do NOT include escrow/payment, KYC center, invitations, favorite friends, or notification-setting panels (on hold).
```

## S14 공개 프로필

> 와이어프레임 v4 `profile` + 사용자 결정 D-A8(취향·대화 방식·MBTI)·D-A9(Ai 브리핑 UI 선구현)·D-A10(새 후기 시안)·D-A11(마스킹 이름, "25세")·D-A12("15당").

```text
Design the public profile screen ("프로필"), following the design system. No bottom tab bar; light gray page background with white cards.

1. Top bar: back, title "프로필"
2. Profile card: large photo, masked name "김*연", "25세 · 서울 마포구", sweetness badge "15당", "동행 7회"
3. Card "소개": "서두르지 않고 서로 배려하는 동행을 좋아해요."
4. Card "취향과 활동" — chips: 전시 / 공연 / 산책
   Same card, heading "대화 방식" — chips: 조용한 대화 / 일정 미리 정하기
   Same card, heading "MBTI" — one chip: ISFJ (hide the MBTI row if not entered)
5. Card "✦ Ai 브리핑" (light violet tinted card, sparkle icon):
   - Body: "약속 시간을 잘 지키고, 상대의 속도에 맞춰 대화한다는 이야기가 많아요."
   - Caption clearly visible: "사용자 리뷰를 바탕으로 동행 성향을 요약했습니다."
6. Section "리뷰": review items. Each item: reviewer small photo + masked name "이*린", review text "전시 보는 속도가 비슷해서 편안했어요.", tag chips "시간을 잘 지켜요" / "대화가 편해요", small "!" icon button on the right (a11y "이*린의 리뷰 신고").
   Empty state: "아직 공개된 리뷰가 없어요."
7. Collapsible "당도는 어떤 정보인가요?": "가입하면 15당에서 시작해요."

Artboards:
(A) Viewing someone else (logged in): quiet bottom row [신고하기] [차단하기].
(B) Self preview: no action row, notice "다른 회원에게 이렇게 보여요. 휴대폰 번호·실명·생년월일은 공개되지 않아요."
(C) New member: "15당", no reviews, no Ai 브리핑 card.
```

## S15 프로필 사진 변경

```text
Design a compact "프로필 사진" edit sheet, following the design system.
- Large circular photo preview with state label: "저장된 사진" / "저장 전 사진" / "사진 없음"
- Buttons: before save [다시 선택] [이 사진으로 저장]; saved state [사진 변경] [사진 삭제]
- Helper "JPG·JPEG·PNG, 10MB 이하"
- Delete confirmation dialog: "사진을 삭제할까요?" / "사진을 삭제하면 새 사진을 등록할 때까지 프로필이 미완성으로 표시되고 신청·공고 작성이 제한돼요." [취소] [삭제]
- Close button [닫기]
```

## S15-2 프로필 설정 (가입 직후)

> 사용자 결정 D-A8. 가입 완료 후 프로필 생성 단계에서 취향과 활동·대화 방식·MBTI를 입력받는다.

```text
Design the profile setup flow shown right after sign-up, following the design system. Full-screen, no bottom tab bar, step progress bar at top.

Step 1/3 — "어떤 활동을 좋아하세요?"
- Multi-select chips "취향과 활동" (up to 5): 전시, 공연, 축제, 팝업, 산책, 식사, 카페, 운동, 여행, 사진, 스터디, 쇼핑
- Counter "3/5"

Step 2/3 — "어떤 대화 방식이 편하세요?"
- Multi-select chips "대화 방식" (up to 3): 조용한 대화, 활발한 대화, 일정 미리 정하기, 즉흥적으로, 답장은 여유 있게, 빠른 답장

Step 3/3 — "MBTI를 알려주세요"
- 4x4 grid of 16 MBTI buttons (ISTJ … ENFJ), single select
- Also a full-width option "잘 모르겠어요"
- Short intro textarea "소개" (optional, 300 chars, counter)
- Preview card at bottom: "다른 회원에게 이렇게 보여요" with masked name, age "25세", chips

Bottom: [이전] + [다음] / last step [프로필 완성하기]; top-right text button "나중에 하기".
Artboards: one per step.
```

---

# 3차 — 정책 결정 후 진행

> 아래 화면의 문구·버튼은 남은 정책(완료·분쟁·평가·취소·신고)에 따라 바뀔 수 있다. 정책 결정 기록이 확정된 뒤 문구를 갱신하고 사용한다.

## S16 약속 상세

```text
Design the appointment detail screen ("약속 상세"), following the design system.

- Status badge + headline: "함께할 약속을 확인해 주세요" / "동행 완료를 확인해 주세요" / "내 동행 완료를 확인했어요" / "취소된 동행이에요" (+ cancel reason if any)
- Title; info card: date/time, public area, private detailed address (visible to matched pair)
- Partner card: avatar, masked name, sweetness, intro → profile
- Completion block: status badge ("동행 완료 대기" / "동행 완료" / "이의 검토 중"), explanation (e.g. "동행이 끝났어요. 한 명이 완료하면 동행 전체가 바로 완료돼요." / "이의 검토 중에는 평가 작성과 공개 시계가 모두 멈춰요."), buttons [내 동행 완료 확인] [완료 이의 제기] [평가 남기기 / 상대 평가 대기 중 / 공개된 후기 보기]
- Buttons: [동행 대화방 바로가기], secondary [안심 5대 수칙]
Do not include "arrival alert", "directions", "share", or "report" buttons (not available).
```

## S17 동행 평가

```text
Design the review sheet ("동행 평가"), following the design system.
Artboards:
(A) Write: blind-review info box "완료 알림 뒤 24시간은 공개가 보류돼요. 양쪽 평가가 있으면 보류 종료 즉시, 한쪽만 있으면 7일 기한에 공개됩니다." + deadline; 1–5 star rating (large); optional comment (300 chars, counter); note "제출 후 수정할 수 없어요. 당도에는 아직 자동 반영하지 않아요."; primary [평가 제출하기].
(B) Submitted: "내 평가를 제출했어요", status table (내 평가 제출완료 / 상대 평가 대기).
(C) Published: "후기가 공개됐어요" + reason + partner review card (stars, comment).
(D) Not available: "지금은 평가할 수 없어요" + reason.
```

## S18 취소 다이얼로그

```text
Design a cancellation bottom sheet, following the design system.
- Title "신청을 취소할까요?" (variant: "확정 동행을 취소할까요?")
- Reason radio: 일정이 변경됐어요 / 개인 사정이 생겼어요 / 조건이 맞지 않아요 / 기타 (shows text input, 300 chars)
- Notes: "취소하면 사유가 대화방과 알림에 표시돼요. 이전 대화는 남지만 새 메시지는 보낼 수 없습니다."
- Buttons: [유지하기] secondary, [신청 취소하기] destructive
```

## S19 안심 동행 5대 수칙

```text
Design the safety rules sheet "안심 동행 5대 수칙", following the design system. Calm, trustworthy, not alarming.
Five numbered rule cards with icons:
1. 공공장소에서 첫 만남
2. 음주 강요·과도한 음주 금지
3. 금전 거래·사적 개인정보 요구 금지
4. 귀가 안심 체크·일정 준수
5. 위급 시 112 신고
Trust banner: "휴대폰 확인 여부와 공개 프로필·후기를 살펴보고, 정확한 장소는 매칭이 확정된 상대에게만 공유하세요."
Primary button [안전 수칙을 준수하겠습니다].
```

---

## 보류 — 제품 결정이 먼저 필요한 화면

실서비스에서 버튼은 보이지만 누르면 "아직 준비 중" 안내만 뜨는 기능들이다. UT에서 "왜 안 되지" 혼란의 원인이 될 수 있다. **숨길지, '준비 중'으로 보여줄지** 먼저 정한다.

| 기능 | 현재 실서비스 | 관련 정책 질문 |
|---|---|---|
| 신고하기(노쇼 센터)·차단 | 준비 중 안내 | 신고·제재 (Q31, Q36~Q38 등) |
| 초대 관리·관심친구·알림 설정 | 빈 목록 + 준비 중 | 초대·알림 (Q42~Q45) |
| 공고 수정·조기 마감·삭제 | 준비 중 안내 | — (구현 범위 결정) |
| 확정 동행 취소·도착 안심 알림 | 준비 중 안내 | 완료·취소 |
| KYC 인증·PRO 유료 결제·안심 통화 | 준비 중 안내 | 후속 범위 |
| 에스크로 탭 | 예시 데이터 고정 노출 | 후속 범위 |

⚠️ **문구 충돌 발견:** 신고 화면(ReportModal)은 "운영팀에서 실시간 확인 후 계정 조치 및 당도 감점 처리가 진행됩니다"라고 안내하지만, 실제 알림 문구는 "실제 운영팀·기관에 전달되지 않았고 자동 제재나 당도 감점도 없어요"라고 한다. 신고 정책 결정 때 함께 정리해야 한다.

---

## 사용자 결정 반영 (2026-09-18)

`docs/prompts/02_남은_정책_재확인_진행_프롬프트_2026-09-17.md` 7-2의 D-A1~D-A12를 반영했다.

| 결정 | 반영 화면 |
|---|---|
| D-A1 카테고리 필수 | S03 |
| D-A2 주소 검색, 시·구·동만 공개 | S03 (D-A13: 카카오 우편번호 + 카카오 로컬) |
| D-A3 아이폰 캘린더식 일정·모집 마감 | S03 |
| D-A4 나이 범위 슬라이더 + 키보드 입력 | S04 (하한 18/19세는 재확인 중) |
| D-A5 태그·파트너에게 바라는 점 유지 | S03, S04 |
| D-A6·D-A7 실제 행사, 팝업/전시/축제/공연 4분류 | S03 이벤트 선택, S09-2, S09-3 |
| D-A8 취향·대화 방식·MBTI | S13, S14, S15-2 |
| D-A9 Ai 브리핑 UI 선구현 · D-A16 캡션 문구 | S14 |
| D-A10 긍정 후기·태그·리뷰 신고 | S14 (재확인 중) |
| D-A11 마스킹 이름 + "25세" 표기 | 전체 |
| D-A12 기본 당도 "15당" | 전체 |

> 최신 상태·결정 배경은 `docs/handoffs/CLAUDE_CODE_인수인계_2026-09-18.md`.
