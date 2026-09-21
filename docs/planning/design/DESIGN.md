# YUMIDANG (유미당) — Design System

> Source of truth: the **Home tab** of the live app (`frontend/src/App.tsx` home view, `Header`, `EventBanner`/`EventCarousel`, `AppointmentReminders`, `CategoryGrid`, `BottomNav`, `CarouselBar`).
> Extracted 2026-09-18. Other screens are NOT references — they are the ones being redesigned.
> Use this file as the design context for Google Stitch (paste or attach it before each screen prompt).

---

## 1. Brand & Mood

- Service: 유미당 — a Korean mobile service for finding a companion (동행) for exhibitions, festivals, meals, sports, travel, etc. Users are verified adults; safety and trust matter.
- Personality: friendly, light, trustworthy, a little playful. Not flashy, not corporate.
- Visual keywords: clean white surfaces, one confident violet accent, soft pastel category tiles, large rounded corners, very soft shadows, generous whitespace, bold short Korean headings.
- Language: all UI copy is Korean. Short, polite-casual tone (~해요 style). e.g. "어떤 동행을 찾고 계신가요?", "전체보기", "약속 확인".

## 2. Layout

- Mobile only. App column **max-width 440px**, centered. Page background outside the column: `#F2F4F8`. App column background: `#FFFFFF`.
- Horizontal page padding: **20px** (`px-5`).
- Section vertical rhythm: section top 12–16px, section title → content 12–14px, between sections ~20px.
- Sticky header at top (height ≈ 64px). Fixed bottom navigation (height ≈ 64px). Scroll content needs bottom padding ≈ 96px so nothing hides behind nav/FAB.
- Floating action button (FAB) sits above the bottom nav at right: 24px from column edge, 74px from bottom.
- Horizontal carousels: each card is `100% - 20px` wide so the next card peeks; snap to start; 12px gap; below it a thin progress bar (not dots).

## 3. Color Tokens

### Core
| Token | Hex | Use |
|---|---|---|
| `primary` | `#6C2CF5` | Brand violet. Logo text, active tab, primary buttons, FAB, badges, links, selected ring, progress fill |
| `primary-hover` | `#5820D8` | Pressed/hover state of primary |
| `primary-soft` | `#F0EDFF` | Tinted chip/pill background with primary text (e.g. verified user chip) |
| `primary-surface` | `#F8F6FF` | Tinted card background (appointment card) |
| `primary-border` | `#EDE9FE` (purple-100) | Border on tinted cards |
| `accent-violet` | `#8B5CF6` | Decorative icon only (sparkle next to section title) |
| `alert-dot` | `#FF6B35` | Unread notification dot |

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `bg-page` | `#F2F4F8` | Outside app column |
| `surface` | `#FFFFFF` | App background, cards, nav, header |
| `surface-muted` | `#F9FAFB` (gray-50) | Empty state blocks, hover backgrounds |
| `line` | `#F3F4F6` (gray-100) | Dividers, subtle borders |
| `track` | `#E5E7EB` (gray-200) | Progress track, disabled fill |
| `text-strong` | `#111827` (gray-900) | Headings |
| `text` | `#1F2937` (gray-800) | Body, labels, icons |
| `text-sub` | `#4B5563` / `#6B7280` (gray-600/500) | Meta info, inactive tab labels, "전체보기" |
| `text-faint` | `#9CA3AF` (gray-400) | Hints, footnotes, captions |

### Category pastel pairs (icon tile background / icon color)
| Category | Tile bg | Icon color |
|---|---|---|
| 지금 | `#FFFBE6` | `#D97706` (text "당!" mark) |
| 전시 | `#F0EDFF` | `#7C3AED` |
| 축제 | `#FFEBEE` | `#FF385C` |
| 식사 | `#FFF8E6` | `#E68A00` |
| 운동 | `#E8F5FF` | `#0284C7` |
| 여행 | `#EAFAF1` | `#059669` |
| 클래스 | `#F2EDFF` | `#6C2CF5` |
| 산책 | `#FFF2E8` | `#EA580C` |
| 스터디 | `#E8F4FA` | `#0284C7` |
| 공연 | `#FFEEF2` | `#DB2777` |
| 쇼핑 | `#F4EDFF` | `#6C2CF5` |
| 기타 | `#F1F3F5` | `#4B5563` |

Pastels are ONLY for category identity. Do not use them for status or buttons.

### Status colors (keep semantic, low saturation backgrounds)
| Meaning | Text | Background |
|---|---|---|
| Open / in progress | `#6C2CF5` | `#F5F3FF` |
| Accepted / success | `#15803D` | `#F0FDF4` |
| Ended / neutral | `#6B7280` | `#F3F4F6` |
| Warning / notice | `#78350F` | `#FFFBEB` with `#FEF3C7` border |
| Error / destructive | `#7F1D1D` text, `#DC2626` button | `#FEF2F2` |

## 4. Typography

- Font: **Pretendard** (fallback: Apple SD Gothic Neo, Noto Sans KR, system-ui). Korean-first.
- Headings use tight letter-spacing (`tracking-tight`, about -0.01em ~ -0.02em).

| Role | Size / Weight | Example |
|---|---|---|
| Logo wordmark | 22px / 800 extrabold, primary color | 유미당 |
| Page title | 20px / 700 | 나의 동행 |
| Section title | 17–18px / 700, gray-900 | 어떤 동행을 찾고 계신가요? |
| Card title on image | 20px / 700, white, leading-snug | event title |
| Card title | 16px / 700, leading-snug | appointment title |
| Body | 14px / 400–500 | |
| Label / tile name | 13px / 500, gray-800 | 전시 |
| Nav label | 12px / 500 (active 700 primary) | 홈 |
| Meta / chip / button-small | 12px / 500–700 | 전체보기, 약속 확인, badge |
| Caption / footnote | 10–11px / 400, gray-400 | 프로토타입 예시 행사 |

## 5. Shape

| Token | Radius | Use |
|---|---|---|
| `radius-hero` | 22px | Large carousel cards (event, appointment) |
| `radius-tile` | 20px | Category tile |
| `radius-icon` | 15px | Icon container inside tile (48×48) |
| `radius-card` | 16px (rounded-2xl) | Standard list cards |
| `radius-control` | 12px (rounded-xl) | Buttons, inputs, inner info boxes |
| `radius-chip` | 8px (rounded-lg) | Small labels on images, small header button |
| `radius-full` | 9999px | Pills, avatars, FAB, D-day badge, progress bar |
| Bottom sheet top | 28px | Modals sliding from bottom |

## 6. Elevation

- Tile: `0 2px 12px rgba(0,0,0,0.03)` → hover `shadow-md`.
- Bottom nav: `0 -4px 24px rgba(0,0,0,0.04)`, background white 95% + backdrop blur.
- FAB: `0 4px 16px rgba(108,44,245,0.45)`.
- Cards generally rely on border (`gray-100` / `purple-100`) or tint instead of heavy shadow. Never use dark or hard shadows.

## 7. Iconography

- Lucide icons, outline style, stroke 1.9–2 (active nav 2.5 with primary fill).
- Sizes: 14px inline meta (calendar, map-pin), 15–16px chevrons, 18px section decoration, 23px header/nav, 28px FAB plus.
- Meta rows = small icon + gray-600 12px text, 6px gap.

## 8. Core Components (from Home)

### Header (sticky)
- White, padding 20px × 14px. Left: 36px circular logo image + "유미당" wordmark. Right: login state + bell.
- Guest: small primary button "로그인" (12px bold, white text, radius 8px).
- Logged in: pill chip, `primary-soft` bg, shield-check icon + masked name · age group, 12px bold primary.
- Bell 23px icon button, 40px hit area; unread = 10px orange dot with 2px white ring at top-right.

### Section header
- Title (17–18px bold) left, optional decorative sparkle icon; right text link "전체보기 >" (12px gray-500) or count/hint in gray-400.

### Hero image card (event)
- Min height 250px, radius 22px, photo cover + bottom-up black gradient (90% → 35% → 10%).
- Top row: white label chip (type) left, primary status chip right (ended = gray-700 chip, whole card grayscale + 60% opacity).
- Bottom text in white: meta 12px (85% opacity) → title 20px bold → subtitle 12px (80% opacity).

### Tinted info card (appointment reminder)
- Radius 22px, `primary-surface` bg, `primary-border` 1px, padding 16px.
- Top: "매칭 확정" 12px bold primary + D-day pill (primary bg, white, 12px bold).
- Title 16px bold; meta rows with icon (date, place); bottom-right link "약속 확인 >" primary 12px semibold.

### Category tile grid
- 4 columns, 10px gap. Tile: white, radius 20px, padding 12px vertical, soft shadow; 48×48 pastel icon box (radius 15px) + 13px label.
- Selected: 2px primary ring. Press: scale 0.95.

### Carousel progress bar
- 4px tall, full width, gray-200 track, primary fill segment = 1/count width that slides. Top margin 16px.

### Bottom navigation (fixed)
- 4 tabs evenly spaced: 홈 / 둘러보기 / 채팅 / 나. Icon 23px over 12px label.
- Active: primary icon (filled) + bold primary label. Inactive: gray-500 icon, gray-600 label.
- Chat tab can show unread count badge.

### FAB
- 54px circle, primary bg, white plus (28px, stroke 2.6), purple glow shadow. Label (a11y): "동행 모집하기". Hidden on chat screens.

### Buttons (derived)
- Primary: primary bg, white bold text, radius 12px, height 44–48px (full-width in sheets), pressed `primary-hover`, disabled gray-200 bg + gray-500 text.
- Secondary: gray-100 bg, gray-600 text, radius 12px.
- Soft: `#F5F3FF` bg, primary text.
- Text link: primary or gray-500, 12px, optional chevron.
- Destructive: red-600 bg, white text — only for irreversible actions.

### Status / notice banner
- Full-width strip under header: warning = amber-50 bg, amber-100 bottom border, amber-950 12px text, optional compact dark action button on the right.

### Empty state
- Rounded block (24px) gray-50 bg, centered 14px gray-500 text, ~56px vertical padding. Optional muted icon above.

## 9. Motion

- Press feedback: `scale(0.95)` on tiles, FAB, icon buttons.
- Transitions 150–200ms on color/transform. Carousel uses native scroll-snap.
- Respect reduced motion: no required animation.

## 10. Rules (Do / Don't)

- DO keep a single accent color (violet). Everything else is white + gray + category pastels.
- DO keep 20px side padding and large radii (16–22px) consistently on every screen.
- DO keep touch targets ≥ 44px and body text ≥ 12px (captions only may be 10–11px).
- DO show privacy/safety notes in calm gray or amber, never alarming red unless it is an error.
- DON'T use gradients on buttons or backgrounds (image overlay gradient only).
- DON'T introduce new accent colors, emoji-heavy decoration, or dark mode for now.
- DON'T use heavy card shadows or borders darker than gray-200.
