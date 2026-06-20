---
title: "Imchef 기능 추가 델타 — 5종"
stage: "project-plan"
depends-on: []
created-at: 2026-06-20
status: draft
---

# Imchef 기능 추가 델타 계획서

> 기존에 운영 중인 Imchef(레시피 공유 SNS)에 5개 기능을 **가산적으로** 추가한다.
> 이 문서는 5개 기능 명세(`feature-specs/01~05`)의 공유 컨텍스트·결정사항을 묶는 상위 계획서다.
> 기존 동작/데이터/디자인을 깨지 않고(additive-only), 기존 컨벤션을 그대로 반영(reflect)한다.

## 1. 현재 앱 사실 (변경 불가 기준선)

- **스택**: Next.js 16 (App Router, `src/` 레이아웃) · React 19 · TypeScript · Prisma 7(PostgreSQL) · Supabase(Storage: `recipe-images` 버킷) · iron-session(쿠키 세션) · Tailwind CSS v4.
- **인증**: `iron-session` 기반. API 라우트에서 `getIronSession<SessionData>`로 `session.userId` 확인. 로그인 필요 액션은 401 반환. 클라이언트는 `AuthContext`(`useAuth`)로 사용자 상태 보유.
- **디자인 시스템 (globals.css `@theme`)**: 흑백(Black & white) 라인 중심. Primary/accent = `--color-ink` `#141414`(별도 컬러 액센트 없음). 토큰: `--color-base #fff`, `--color-ink`, `--color-ink-soft #565656`, `--color-ink-faint #9a9a9a`, `--color-line`(hairline), `--color-edge`(crisp 0.85 검은 테두리). 폰트: Pretendard.
  - 유틸/컴포넌트 클래스: `glass`(흰 면+검은 1px 테두리), `glass-bar`(반투명+backdrop-blur 22px, 떠 있는 헤더/푸터), `fchip`/`fchip-liked`(라인 칩), `btn-primary`(ink 채움)/`btn-secondary`/`btn-danger`, `input-field`(rounded-2xl, focus 시 ink 테두리+ring), `card`(rounded-3xl glass).
  - 키프레임: `slide-down`, `rise`, `pop`. 라운드는 full/2xl/3xl 위주, 둥근 알약형(footer는 `rounded-full`).
  - **신규 UI는 이 토큰/클래스를 재사용한다. 새 팔레트·새 컬러 액센트 도입 금지.**
- **핵심 컴포넌트**: `Header`(sticky, `glass-bar`, `Ladle` 마크 + "Imchef" 워드마크), `BottomNav`(fixed `glass-bar rounded-full`, 돋보기·좋아요·공유·사람 4버튼), `FeedPost`, `RecipeForm`(+`ImageUploader`/`IngredientInput`/`StepInput`), `PasswordModal`, `icons.tsx`(SVG 아이콘 세트, `Ladle` 포함).
- **컨텍스트**: `AuthContext`, `SearchContext`(`open`/`query`/`toggle` — 홈 피드 클라이언트 필터 검색).
- **데이터 모델(Prisma)**: `User`, `Recipe`(title, description?, servings, cookTime?, difficulty, referenceUrl?, …), `RecipeIngredient`, `RecipeStep`, `RecipeImage`(url, order), `Like`, `Comment`.
- **이미지 업로드**: `POST /api/upload`(multipart) → Supabase Storage `recipe-images` 업로드 → 공개 URL 반환. 5MB 제한, jpg/png/webp/gif 허용. 로그인 필수.
- **레시피 검색(현행)**: 홈(`/`)에서 상단 슬라이드 검색 입력창 + 하단 `BottomNav` 돋보기로 토글. `SearchContext.query`로 **클라이언트 측 피드 필터**(title/nickname/description includes). 별도 검색 API 없음.

## 2. 추가 기능 개요 (5종)

| # | 기능 | 한 줄 | 디자인 시안 | AI |
|---|------|------|:---:|:---:|
| 01 | 하단 검색 모핑 | `BottomNav`(돋보기·좋아요·공유·사람) → 돋보기 탭 시 푸터 테두리 유지한 채 검색 입력창으로 모핑, 외부 탭 시 복귀. 상단 헤더 검색은 제거. | — | — |
| 02 | AI 이미지 생성 | 새 레시피 사진 영역에 "AI 이미지 생성" 진입점. 클릭 시 배경 블러 + 프롬프트 입력 → 생성형 UI로 후보 이미지 제시 → 선택 시 레시피 사진으로 등록. | 5개 | Gemini(이미지) |
| 03 | 스켈레톤+로딩 시스템 | 로딩이 필요한 모든 영역을 스켈레톤 + **원형 프로그레스(circular progress)** 로딩 UI로 통일. | — | — |
| 04 | 로고/브랜드 마크 | 현재 `Ladle`(국자) 아이콘이 돋보기처럼 보여 어색함. 브랜드에 맞는 로고 시안 제시 후 교체. | 5개 | — |
| 05 | URL→AI 레시피 자동생성 | 새 레시피 등록 시 유튜브/블로그 URL 입력 → "링크 등록하고 AI 레시피 자동생성" → Gemini가 분석해 폼 자동 채움(사용자 수정 가능). 생성 중 세련된 미래지향(Gemini 스타일) 로딩. | 5개 | Gemini(URL/영상 분석) |

## 3. 횡단 결정 사항 (모든 관련 기능에 적용)

### 3.1 Gemini 연동 = Vercel AI Gateway
- 기능 02·05의 모델 호출은 **Vercel AI Gateway 경유**로 일원화한다(공급자 키 관리 일원화, 옵저버빌리티). AI SDK v6 + `"google/gemini-..."` 형태의 게이트웨이 모델 문자열 사용.
- 권장 모델:
  - **이미지 생성(02)**: Gemini 이미지 생성 모델(예: `google/gemini-2.5-flash-image` 계열, a.k.a. Nano Banana). 텍스트 프롬프트 → 이미지.
  - **URL/영상 분석(05)**: Gemini 멀티모달 모델(예: `google/gemini-2.5-flash` 계열, URL context / YouTube 이해). URL → 구조화 레시피(JSON, AI SDK `generateObject` + Zod 스키마).
- **키 부재 시 동작**: 현재 env에 Gemini/Google 키 없음. 빌드 단계에서 `AI_GATEWAY_API_KEY`(또는 Vercel OIDC 자동 인증) 설정 필요. 키 미설정 시 AI 진입점은 노출하되 호출 실패를 사용자 친화 에러로 처리(기능 02·05 §8 참조).
- **추상화**: AI 호출은 `src/lib/ai/`(예: `gemini.ts`)에 캡슐화. 라우트(`/api/ai/*`)에서만 호출하고 클라이언트에 키 노출 금지(server-only).

### 3.2 로딩 UI 표준 (기능 03이 정의, 02·05가 소비)
- 데이터/네트워크 대기 영역은 **스켈레톤(레이아웃 점유) + 원형 프로그레스 스피너** 조합으로 통일.
- 신규 공용 컴포넌트: `src/components/ui/Spinner.tsx`(원형 프로그레스), `src/components/ui/Skeleton.tsx`(라인). 기존 `animate-pulse` 인라인 스켈레톤(홈 피드, 상세)도 점진 교체.
- 흑백 토큰 준수(스피너 트랙=`--color-line`, 진행=`--color-ink`). 기능 05의 "미래지향 로딩"은 03 표준 위에 연출을 더한다(새 팔레트 도입 없이 ink 그라데이션/모션).

### 3.3 디자인 시안 정책 (기능 02·04·05)
- "시안 5개"는 **명세 단계가 아니라 빌드/디자인 단계 산출물**이다. 본 명세는 *동작·데이터·상태·권한* 만 확정한다(gen-spec 원칙: 시각 결정은 다운스트림).
- 빌드 시 `frontend-design:frontend-design`로 각 5개 시안을 로컬 렌더 → 사용자가 1개 선택 → 토큰/마크업 lock. 흑백 라인 미감·기존 토큰과 시각 연속성 유지가 제약.

### 3.4 가산성/회귀 안전 (모든 기능 공통)
- Prisma 스키마 변경은 **EXPAND-only**(신규 nullable 컬럼/신규 테이블만). 기존 컬럼 drop/rename/NOT NULL 강화 금지.
- 기존 API/컴포넌트 시그니처는 보존(추가 prop은 optional). 기존 검색·업로드·CRUD 동작 불변.
- 신규 라우트는 기존과 동일한 iron-session 인증 패턴을 따른다.

## 4. 영향 범위 (touch set)

- **신규 파일**: `src/lib/ai/gemini.ts`, `src/app/api/ai/generate-image/route.ts`, `src/app/api/ai/recipe-from-url/route.ts`, `src/components/ui/Spinner.tsx`, `src/components/ui/Skeleton.tsx`, `src/components/AiImageGenerator.tsx`, `src/components/UrlRecipeImport.tsx`, 로고 마크 컴포넌트(`icons.tsx` 내 신규 export 또는 `Logo.tsx`).
- **수정 파일**: `BottomNav.tsx`(모핑), `Header.tsx`(검색 제거 영향 없음 — 헤더엔 검색 없음 / 로고 교체), `src/app/page.tsx`(상단 검색 입력 제거, 하단 모핑으로 일원화), `ImageUploader.tsx` 또는 `RecipeForm.tsx`(AI 진입점), `RecipeForm.tsx`(URL 자동생성), 로딩 영역 다수(점진 교체), `icons.tsx`(`Ladle` 교체/추가), `package.json`(ai sdk 의존성).
- **데이터**: 변경 없음 권장. (선택) `Recipe`에 `aiGenerated`/`sourceUrl` 같은 추적 컬럼이 필요하면 nullable 추가 — 각 기능 명세 §4에서 판단.
- **환경변수**: `AI_GATEWAY_API_KEY`(또는 Vercel OIDC) 추가 필요.

## 5. 용어 정의

| 용어 | 정의 |
|------|------|
| 모핑(morph) | 하단 푸터 컨테이너(테두리/모양 유지)가 버튼 묶음 ↔ 검색 입력창으로 형태 전환되는 애니메이션 |
| 생성형 UI(generative UI) | AI 생성 결과(이미지 후보 등)를 점진적으로 드러내며 선택하게 하는 인터랙티브 UI |
| 원형 프로그레스 | 회전하는 원형(ring) 스피너 형태의 로딩 인디케이터 |
| AI 자동생성 | URL 분석으로 레시피 폼 필드를 사전 채움(prefill)하는 동작. 사용자가 등록 전 자유 수정 가능 |
| 시안 | frontend-design으로 생성하는 디자인 후보(기능당 5개) |

## 5.1 시안 선택 (2026-06-20 lock)

빌드 시 `frontend-design`로 생성한 5개 시안 중 사용자가 선택:
- **기능 02 (AI 이미지 생성) → 시안 1: 풀스크린 블러 시트** — 배경 폼이 비치는 백드롭 블러 + 바텀 rise 카드. 프롬프트 입력 → 생성중(원형 프로그레스+스켈레톤) → 후보 그리드 선택.
- **기능 04 (로고) → 시안 4: Cutlery** — 포크+숟가락 세로 병치 라인 마크(원+사선 없음 → 돋보기와 구별). `icons.tsx`의 `Ladle` 교체.
- **기능 05 (URL→AI 레시피) → 시안 2: 스캔라인 Sweep** — URL/썸네일 위를 좌→우 광선 그라데이션이 훑는 미래지향 로딩 + 하단 2px 프로그레스 바. 완료 시 폼 prefill.

시안 원본: `docs/design-mockups/feat-0{2,4,5}-*-5cases.html`.

## 6. 다운스트림 빌드 순서(권장)

03(로딩 표준) → 04(로고) → 01(검색 모핑) → 02(AI 이미지) → 05(URL 자동생성). 03을 먼저 깔면 02·05가 표준 로딩을 재사용한다.
