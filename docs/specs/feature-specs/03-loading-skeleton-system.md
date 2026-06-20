---
title: "스켈레톤+로딩 시스템"
stage: "feature-spec"
depends-on:
  - "docs/specs/00-feature-delta-plan.md"
created-at: 2026-06-20
status: draft
---

# 기능 03 — 스켈레톤 + 로딩 시스템

> Imchef의 **모든 로딩 영역을 단일 표준으로 통일**하는 공용 프론트엔드 UI 시스템.
> 원형 프로그레스(circular progress) 스피너와 라인/블록 스켈레톤 두 종의 공용 컴포넌트(`Spinner`, `Skeleton`)를 도입하고,
> 현재 각 화면에 흩어진 인라인 `animate-pulse` 스켈레톤·텍스트형 로딩("저장 중...", "업로드중...", "불러오는 중...")을 점진 교체한다.
> 이 기능은 **다른 기능(02 AI 이미지 생성·05 URL→AI 레시피 자동생성)이 소비할 로딩 표준**을 정의한다.

---

## 1. 개요

- **해결하는 문제**:
  현재 로딩 표현이 화면마다 제각각이다. 홈 피드(`src/app/page.tsx`)·레시피 상세(`src/app/recipes/[id]/page.tsx`)·내 레시피(`src/app/my-recipes/page.tsx`)는 인라인 `animate-pulse` 블록을, 레시피 수정(`src/app/recipes/[id]/edit/page.tsx`)은 `"불러오는 중..."` 평문을, 이미지 업로드(`src/components/ImageUploader.tsx`)는 `"업로드중..."`, 폼 제출(`src/components/RecipeForm.tsx`)은 `"저장 중..."` 텍스트만 노출한다. 그 결과 (1) 화면 간 로딩 인디케이터가 시각적으로 불일치하고, (2) 텍스트형 로딩 영역은 진행 중임을 시각적으로 약하게 전달하며, (3) 곧 추가될 AI 기능(02·05)이 재사용할 "원형 프로그레스" 표준이 없어 각자 다시 구현할 위험이 있다. 또한 일부 영역은 스켈레톤이 실제 콘텐츠와 크기가 달라 데이터 도착 시 **레이아웃 시프트(CLS)**를 유발한다.

- **제공하는 가치**:
  - **일관성**: 전 영역이 동일한 원형 프로그레스 스피너 + 동일한 스켈레톤 톤(흑백 라인)을 사용 → 브랜드 일관성 확보, 로딩 관련 시각 코드 중복 제거(현재 4종 인라인 패턴 → 2개 공용 컴포넌트).
  - **재사용**: 기능 02·05가 별도 구현 없이 `Spinner`/`Skeleton`을 import만 하면 됨(빌드 순서상 03을 먼저 깔도록 §00 6에서 명시).
  - **성능/안정성**: 스켈레톤이 실제 콘텐츠와 동일한 박스 크기를 점유 → 데이터 도착 시 레이아웃 시프트 방지(CLS 0에 근접).
  - **접근성**: 모든 로딩 영역에 `role=status` / `aria-busy` 부착, `prefers-reduced-motion` 존중으로 회전 모션 제거 폴백 제공.

- **범위**:
  - **다루는 것**:
    - 공용 컴포넌트 2종 신규 도입: `src/components/ui/Spinner.tsx`(원형 프로그레스), `src/components/ui/Skeleton.tsx`(라인/블록 스켈레톤).
    - 로딩 패턴 카탈로그 정의(초기 로딩·추가 로딩·인라인 액션 로딩·전체 화면 로딩).
    - 기존 인라인 로딩 영역의 점진 교체(홈 피드 초기/더보기, 레시피 상세, 내 레시피, 레시피 수정, 폼 제출 중, 이미지 업로드 중).
    - 접근성·reduced-motion·CLS 방지 규약.
    - 다운스트림 소비 가이드(02 AI 이미지 생성 대기, 05 URL 분석 대기에서의 사용 패턴).
  - **다루지 않는 것**:
    - AI 호출 자체의 로직·진행률 산출(기능 02 §6, 기능 05 §6에서 정의). 본 기능은 *표시*만 담당.
    - 기능 05의 "미래지향(Gemini 스타일) 로딩 연출" 고유 모션·텍스트 시퀀스(기능 05 §3에서 03 표준 위에 연출을 더함).
    - 데이터 페칭/에러 복구 로직 자체(각 화면 기능 명세에서 관장). 본 기능은 Loading 상태의 *시각 표준*만 제공.
    - 서버사이드 `loading.tsx`(Next App Router 스트리밍) 전면 도입 — 본 MVP는 클라이언트 상태 기반 교체에 집중(Full 단계 후보, §14).

---

## 2. 사용자 스토리 + 인수 조건

### US-1: 일관된 로딩 인디케이터
As a **Imchef 사용자**, I want **어느 화면에서든 동일한 원형 프로그레스로 로딩을 인지**, so that **앱이 일관되고 신뢰감 있게 느껴진다**

**인수 조건:**
- [ ] AC-1-1: `Spinner` 컴포넌트는 회전하는 원형 ring을 렌더하며, 트랙(미진행 부분)은 `--color-line`, 진행 호(arc)는 `--color-ink` 색을 사용한다. 새 팔레트·새 컬러 액센트를 도입하지 않는다(스타일 인스펙션으로 stroke 색이 두 토큰만임을 검증).
- [ ] AC-1-2: 로딩이 발생하는 모든 영역(홈 피드 초기, 레시피 상세, 내 레시피, 레시피 수정, 폼 제출, 이미지 업로드)에서 동일한 `Spinner` 컴포넌트가 사용된다(grep 결과 인라인 `animate-pulse` 또는 텍스트 단독 로딩이 0건). 잔존 텍스트("업로드중...", "저장 중...", "불러오는 중...")는 스피너와 병기되거나 스피너로 대체된다.
- [ ] AC-1-3: `Spinner`는 `size` prop(`sm` 16px / `md` 24px / `lg` 40px, 기본 `md`)에 따라 외경이 결정되고, `strokeWidth`로 ring 두께를 조정할 수 있다. 동일 size 호출은 픽셀 단위로 동일한 외경을 렌더한다.

### US-2: 콘텐츠 형태를 미리 보여주는 스켈레톤
As a **Imchef 사용자**, I want **데이터가 오기 전 곧 채워질 콘텐츠의 형태(스켈레톤)를 보는 것**, so that **빈 화면 대신 무엇이 로드될지 예측되고 화면이 튀지 않는다**

**인수 조건:**
- [ ] AC-2-1: `Skeleton` 컴포넌트는 `variant`(`line` | `block` | `circle`)에 따라 라인(텍스트 자리), 블록(이미지/카드 자리), 원형(아바타 자리) 형태를 렌더한다.
- [ ] AC-2-2: 스켈레톤 placeholder는 교체될 실제 콘텐츠와 동일하거나 근사한 박스 크기를 차지하여, 데이터 도착 후 **누적 레이아웃 시프트(CLS)가 0.1 미만**이 되도록 한다(예: 홈 피드의 정사각 이미지 스켈레톤은 `aspect-square`로 실제 이미지와 동일 비율).
- [ ] AC-2-3: `Skeleton`은 `count` prop으로 동일 스켈레톤을 N개 반복 렌더할 수 있고(목록 자리 표시), `width`/`height`로 개별 크기를 지정할 수 있다.

### US-3: 접근성과 모션 민감성 존중
As a **스크린리더 사용자 / 모션 민감 사용자**, I want **로딩 상태가 보조기술에 전달되고 과도한 회전 모션이 비활성화되는 것**, so that **로딩을 인지하되 불편함·어지러움을 겪지 않는다**

**인수 조건:**
- [ ] AC-3-1: 로딩 컨테이너(스피너/스켈레톤을 감싸는 영역)에 `role="status"` 와 `aria-busy="true"`가 부착되고, `Spinner`는 `label` prop을 받아 시각적으로 숨긴 텍스트(`sr-only`, 기본값 "불러오는 중")로 노출한다. 데이터 도착 시 `aria-busy`는 `false`가 되거나 해당 노드가 언마운트된다.
- [ ] AC-3-2: `prefers-reduced-motion: reduce` 환경에서 `Spinner`의 회전 애니메이션과 `Skeleton`의 펄스 애니메이션이 비활성화되고, 정적(또는 매우 약한 페이드) 대체 표시로 폴백한다(미디어쿼리 적용을 스타일 인스펙션으로 검증).
- [ ] AC-3-3: 데코레이션용 스피너 SVG 내부 도형에는 `aria-hidden="true"`를 부여해 중복 안내를 막고, 의미 전달은 컨테이너 `role="status"` + `label`로만 한다.

### US-4: 액션 진행 중 피드백 (인라인 로딩)
As a **레시피 작성자**, I want **저장/업로드 버튼을 눌렀을 때 그 자리에서 진행 중임을 보는 것**, so that **중복 클릭하지 않고 처리 중임을 확신한다**

**인수 조건:**
- [ ] AC-4-1: 폼 제출 중(`RecipeForm` submit, `loading === true`) "레시피 등록"/"수정하기" 버튼은 `disabled` 되고 라벨 옆에 `size="sm"` 스피너를 인라인 표시한다(텍스트 "저장 중..." 병기 허용). 처리 완료/실패 시 스피너가 사라지고 버튼이 복구된다.
- [ ] AC-4-2: 이미지 업로드 중(`ImageUploader`, `uploading === true`) 업로드 슬롯에 `size="sm"` 또는 `md` 스피너가 표시되고 파일 input은 `disabled` 된다. 완료 시 썸네일로 전환된다.
- [ ] AC-4-3: 홈 피드 "더 보기" 추가 로딩 중(`loadingMore === true`) 버튼은 `disabled` 되고 라벨 자리에 인라인 `size="sm"` 스피너를 표시한다(기존 "불러오는 중…" 평문을 대체/병기).

### US-5: 다운스트림 AI 기능의 로딩 표준 소비
As a **기능 02·05 개발자**, I want **AI 생성 대기 상태를 공용 컴포넌트로 표현**, so that **각 기능이 로딩 UI를 재구현하지 않고 일관성을 유지한다**

**인수 조건:**
- [ ] AC-5-1: 기능 02(AI 이미지 생성) 후보 생성 대기 영역은 `Skeleton variant="block"`(이미지 후보 자리) + 중앙 `Spinner size="lg"` 조합을 사용한다(02 §3에서 이 패턴을 참조).
- [ ] AC-5-2: 기능 05(URL→AI 레시피) 분석 대기 영역은 폼 자리 표시 `Skeleton variant="line"` 다수 + `Spinner`를 사용하며, 05 고유 "미래지향 연출"은 본 표준 컴포넌트 위에 새 팔레트 없이 ink 기반 모션만 덧붙인다.
- [ ] AC-5-3: `Spinner`/`Skeleton`은 외부 의존성 없이 토큰만으로 동작하여, 02·05가 import 한 줄로 사용 가능하다(public props 시그니처는 §3 컴포넌트 API와 동일).

---

## 3. UI/UX 명세

### 컴포넌트 계층

본 기능은 페이지가 아니라 **두 개의 재사용 UI 프리미티브**와 그 적용처를 정의한다.

```
src/components/ui/
├── Spinner.tsx            // 원형 프로그레스 (회전 ring)
│   └── <span role="status"> > <svg aria-hidden> + <span class="sr-only">{label}</span>
└── Skeleton.tsx           // 라인/블록/원형 placeholder
    └── <div aria-hidden> (단일) | <div role="status"> > N×<div> (count > 1)

소비처 (점진 교체):
Page/Component
├── app/page.tsx              → FeedSkeleton(블록+라인) | "더 보기" 인라인 Spinner(sm)
├── app/recipes/[id]/page.tsx → DetailSkeleton(블록+라인 다수)
├── app/my-recipes/page.tsx   → GridSkeleton(블록 count)
├── app/recipes/[id]/edit     → 전체 화면 중앙 Spinner(lg) + 폼 스켈레톤
├── components/RecipeForm.tsx  → submit 버튼 인라인 Spinner(sm)
├── components/ImageUploader   → 업로드 슬롯 Spinner(sm/md)
└── (downstream) AiImageGenerator(02) / UrlRecipeImport(05)
```

### 컴포넌트 API (props 명세)

> 본 기능은 데이터모델/REST API가 없으므로(§4·§5 참조), 명세의 핵심은 **컴포넌트 public props**다.

#### `Spinner` (원형 프로그레스)

```typescript
type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  /** 외경 프리셋. sm=16px, md=24px, lg=40px. 기본 "md". */
  size?: SpinnerSize;
  /** ring 두께(px). 미지정 시 size별 기본값(sm=2, md=2.5, lg=3). */
  strokeWidth?: number;
  /** 스크린리더용 라벨(sr-only로 렌더). 기본 "불러오는 중". */
  label?: string;
  /** 진행 호 색 토큰 오버라이드. 기본 var(--color-ink). 흑백 토큰만 허용. */
  className?: string;        // 위치/마진 조정용 (색 새 팔레트 금지)
}
```

- 렌더 규약: 외곽 트랙 ring = `var(--color-line)` 풀 원, 진행 arc = `var(--color-ink)` 약 25% 호(circumference의 1/4)를 회전. SVG `<circle>` 2개 또는 conic-gradient 마스크 중 택1로 구현하되 두 색 토큰만 사용.
- 회전: `animation: spin 0.8s linear infinite`(신규 `@keyframes spin`을 `globals.css`에 추가, 360° 회전). `prefers-reduced-motion: reduce`에서 애니메이션 제거.
- 접근성: 루트 `<span role="status" aria-busy="true">`, SVG는 `aria-hidden`, 라벨은 `sr-only`.

#### `Skeleton` (라인/블록 placeholder)

```typescript
type SkeletonVariant = "line" | "block" | "circle";

interface SkeletonProps {
  /** 모양. line=텍스트 자리(높이 작은 둥근 막대), block=이미지/카드 자리, circle=아바타. 기본 "line". */
  variant?: SkeletonVariant;
  /** CSS width (예: "100%", "66%", 240). variant=circle이면 지름. */
  width?: string | number;
  /** CSS height (예: 14, "1rem"). block은 aspect-ratio와 병용 가능. */
  height?: string | number;
  /** 동일 스켈레톤 반복 개수(목록 자리). 기본 1. >1이면 세로 stack 렌더. */
  count?: number;
  /** block 변형의 종횡비(예: "1 / 1", "4 / 3"). CLS 방지용. */
  aspectRatio?: string;
  /** 둥근 정도 클래스 오버라이드. 기본: line→rounded, block→rounded-[20px], circle→rounded-full. */
  className?: string;
}
```

- 배경: `var(--color-line)` 톤의 면 + 미세 펄스(`animate-pulse` 또는 신규 약한 shimmer). 새 색 도입 금지.
- `count > 1`이면 컨테이너에 `role="status" aria-busy="true"` 부착, 개별 막대는 `aria-hidden`. `count === 1` 단일 사용 시 부모 로딩 컨테이너가 `role="status"`를 갖는 것을 전제로 자신은 `aria-hidden`.
- `aspectRatio` 지정 시 height 대신 비율로 박스를 점유해 실제 미디어와 동일 면적 확보(CLS 0).

### 5가지 화면 상태 — "로딩 패턴 카탈로그"

> 본 기능은 단일 화면이 아니므로 5가지 상태를 **로딩 패턴의 분기**로 재해석한다. 각 패턴은 위 컴포넌트로 구현된다.

| 상태 | 조건 | UI 표현 | 사용자 액션 |
|------|------|---------|------------|
| Empty | 데이터 0건(로딩 종료 후) | 로딩 컴포넌트 언마운트 → 각 화면의 `EmptyState`(이모지+문구)로 전환. 스켈레톤/스피너 미표시. | 첫 레시피 등록, 검색어 변경 등(각 화면 관장) |
| Loading-초기 | 첫 페치 진행 중(데이터 아직 없음) | **스켈레톤(콘텐츠 형태 점유) + 필요 시 영역 중앙 `Spinner`**. 홈/내레시피는 카드 스켈레톤, 상세는 이미지 블록+텍스트 라인 스켈레톤, 수정 페이지는 전체 화면 중앙 `Spinner size="lg"`. 컨테이너 `role=status aria-busy`. | 대기(인터랙션 불가 영역). 다른 탭 이동은 가능 |
| Loading-추가/인라인 | 추가 페이지 로드("더 보기") 또는 액션 처리(submit/업로드) 중 | **인라인 `Spinner size="sm"`**: 버튼 라벨 옆/내부. 기존 콘텐츠는 그대로 유지(스켈레톤 미사용), 트리거 버튼만 `disabled`. | 대기. 중복 클릭 차단됨 |
| Error | 페치/액션 실패 | 로딩 컴포넌트 언마운트 → 각 화면 에러 `EmptyState`(예: "불러오지 못했어요") 또는 폼 인라인 에러 메시지로 전환. 스피너 자동 정지. | 재시도(버튼/새로고침), 폼 재제출 |
| Ideal(정상) | 데이터 도착 완료 | 스켈레톤이 실제 콘텐츠로 **무이동 교체**(동일 박스 크기 점유 → CLS 없음). 모든 로딩 노드 언마운트, `aria-busy` 해제. | 해당 화면의 정상 액션 전부 |

### 반응형 대응

- **Mobile (< 768px)**: 기본 타깃(Imchef는 모바일 우선, 피드 `max-w-[520px]`). 카드 스켈레톤은 1열, `Spinner` 기본 `md`. 인라인 스피너 `sm`.
- **Tablet (768px ~ 1024px)**: 동일 컴포넌트, 컨테이너 폭만 확장. 스켈레톤 개수(`count`)는 뷰포트 높이에 맞춰 화면 미만으로 제한(과도한 placeholder 방지).
- **Desktop (> 1024px)**: 동일. 전체 화면 로딩(수정 페이지)은 뷰포트 중앙 정렬 `Spinner size="lg"` 유지.

### 인터랙션 상세

| 인터랙션 | 동작 |
|----------|------|
| 페치 시작 | 로딩 컨테이너 마운트, `aria-busy=true`. 스켈레톤 즉시 표시(지연 없음, 단 §6의 깜빡임 방지 규약 참조). |
| 페치 완료 | 스켈레톤 → 실제 콘텐츠 교체. 동일 박스 점유로 시각적 점프 없음. `aria-busy=false`/언마운트. |
| submit/업로드 클릭 | 트리거 버튼 즉시 `disabled` + 인라인 `Spinner sm` 표시. 응답까지 추가 클릭 무시. |
| 응답 도착(성공) | 스피너 제거, 버튼 복구 또는 화면 전환(예: 등록 후 상세로 이동). |
| 응답 도착(실패) | 스피너 제거, 버튼 복구, 에러 메시지 노출(각 화면 관장). |
| reduced-motion 사용자 | 회전/펄스 모션 제거, 정적 ring + sr-only 라벨로만 로딩 전달. |

### 시각 디자인 스펙 (토큰 매핑)

| 요소 | 색/토큰 | 비고 |
|------|---------|------|
| 스피너 트랙(ring 바탕) | `--color-line` (rgba(20,20,20,0.13)) | 새 색 금지 |
| 스피너 진행 호(arc) | `--color-ink` (#141414) | |
| 스켈레톤 면 | `--color-line` 톤 또는 `bg-white/50`(기존 홈 피드 톤과 연속) | 펄스로 강약 |
| 스켈레톤 펄스 | 기존 `animate-pulse` 재사용 또는 약한 shimmer | reduced-motion에서 off |
| sr-only 라벨 | 시각 비노출 | 접근성 텍스트 |

> 구체 픽셀/모션 디테일(시안)은 빌드/디자인 단계 산출물이며 본 명세는 동작·토큰만 확정한다(§00 3.3).

---

## 4. 데이터 모델

**해당 없음 — 순수 프론트엔드 표시 컴포넌트.**

본 기능은 영속 데이터를 생성·조회·변경하지 않는다. DB 테이블·Prisma 스키마 변경 없음(§00 3.4 EXPAND-only 정책과 무관 — 본 기능은 스키마를 건드리지 않음). 상태는 전적으로 소비처 컴포넌트의 클라이언트 로컬 상태(`loading`, `loadingMore`, `uploading`, `submitting` 등 boolean)이며 §7에서 기술한다.

---

## 5. API 명세

**해당 없음 — 순수 프론트엔드 표시 컴포넌트.**

본 기능은 신규 REST 엔드포인트를 추가하지 않는다. `Spinner`/`Skeleton`은 네트워크 호출 없이 props만으로 렌더된다. 본 컴포넌트가 *표시하는* 로딩의 원천 API(예: `GET /api/recipes`, `POST /api/upload`)는 기존 화면 기능에 이미 존재하며 본 기능은 그 대기 상태의 시각화만 담당한다. 따라서 대신 §3 "컴포넌트 API(props)"가 본 기능의 인터페이스 계약이다.

---

## 6. 비즈니스 로직

### 핵심 로직 — 로딩 상태 전이

소비처가 boolean 로딩 플래그를 본 컴포넌트로 매핑하는 결정 규칙:

```
isInitialLoading (데이터 없음 + 페치중)  → 스켈레톤 + (영역형) Spinner
isPaginating / isSubmitting / isUploading → 인라인 Spinner(sm), 기존 콘텐츠 유지
hasData + !loading                        → 실제 콘텐츠 (로딩 노드 언마운트)
error                                      → 에러 UI (로딩 노드 언마운트)
empty (!loading + !error + count 0)       → EmptyState
```

상태 전이 다이어그램:

```
        ┌──────────── (페치 시작) ────────────┐
        ▼                                     │
   [Loading-초기]                             │
   스켈레톤+스피너                            │
        │                                     │
   ┌────┴───────────────┬──────────┐         │
   ▼                    ▼          ▼          │
[Ideal]            [Empty]     [Error]        │
(콘텐츠)         (EmptyState) (에러UI)        │
   │                                │         │
   │ (더보기/submit/업로드)          │ (재시도)─┘
   ▼                                
[Loading-추가/인라인]               
인라인 Spinner(sm)                  
   │
   ▼
[Ideal] (갱신된 콘텐츠)
```

### 깜빡임(flash) 방지 규약

- **즉시 표시 원칙**: 본 MVP는 스켈레톤을 지연 없이 즉시 렌더한다(빈 화면 방지 우선). 단, 매우 빠른 응답(<150ms 추정)에서 스피너가 한 프레임만 번쩍이는 것을 줄이려면 인라인 액션 스피너는 표시 후 **최소 표시 시간(예: 300ms)** 을 두는 것을 권장(선택 구현, AC 강제는 아님).
- **추가 로딩은 콘텐츠 보존**: "더 보기"·재페치 시 기존 리스트를 비우지 않는다(현행 `page.tsx`가 이미 준수 — `catch`에서 "keep what we have"). 스켈레톤으로 기존 콘텐츠를 덮지 않는다.

### reduced-motion 분기

```
if (matchMedia("(prefers-reduced-motion: reduce)")):
    Spinner  : 회전 애니메이션 미적용 → 정적 ring (진행 호는 고정 표시), role=status로 의미 전달
    Skeleton : 펄스 애니메이션 미적용 → 정적 면 (또는 1회 약한 페이드)
else:
    Spinner  : spin 0.8s linear infinite
    Skeleton : pulse
```

구현은 CSS 미디어쿼리(`@media (prefers-reduced-motion: reduce) { .spinner-anim { animation: none } }`)를 우선으로 하여 JS 없이도 보장한다.

### 유효성 검사 (props 가드)

| props | 규칙 | 처리 |
|------|------|------|
| `size` | `sm`/`md`/`lg` 외 값 | 기본 `md`로 폴백(타입으로 1차 차단) |
| `strokeWidth` | 양수 | 음수/0이면 size별 기본값 사용 |
| `count` | 1 이상 정수 | <1이면 1로 보정 |
| `variant` | `line`/`block`/`circle` | 외 값이면 `line` 폴백 |
| `label` | 비어 있으면 | 기본 "불러오는 중" 사용(빈 a11y 라벨 방지) |

### 엣지케이스

- **케이스 1 — 매우 빠른 응답**: 페치가 즉시 끝나 스켈레톤이 깜빡임 → 위 "최소 표시 시간" 권장 적용(특히 인라인 스피너). 강제 아님.
- **케이스 2 — 에러 후 잔존 스피너**: 액션 실패 시 `finally` 블록에서 로딩 플래그를 반드시 false로 해제해 스피너가 무한 회전하지 않도록 한다(현행 `FeedPost.toggleLike`·`page.tsx.loadMore`가 이미 `finally` 사용 — 동일 규약 유지).
- **케이스 3 — 컴포넌트 언마운트 중 응답 도착**: 사용자가 로딩 도중 페이지를 떠나면(언마운트) setState 경고 방지를 위해 소비처는 표준 abort/guard 패턴을 따른다(본 컴포넌트는 무상태이므로 영향 없음 — 가이드라인으로만 명시).
- **케이스 4 — reduced-motion + 스크린리더 동시**: 모션은 꺼지되 `role=status` 라이브 영역은 유지되어 보조기술에는 정상적으로 "불러오는 중"이 안내된다.
- **케이스 5 — 다크/고대비 환경**: 흑백 토큰만 사용하므로 별도 분기 불필요(앱 전체가 라이트 흑백 테마). 새 팔레트를 도입하지 않아 대비 회귀 위험 없음.

---

## 7. 상태 관리

### 클라이언트 상태

본 컴포넌트(`Spinner`, `Skeleton`)는 **무상태(stateless)** 프레젠테이션 컴포넌트다. 로딩 boolean은 전적으로 소비처가 보유한다. 표준화하는 소비처 상태 모양:

```typescript
// 화면형(초기 로딩 + 추가 로딩)
interface ListLoadingState {
  loading: boolean;       // 초기 페치 중 → 스켈레톤
  loadingMore: boolean;   // "더 보기" 중 → 인라인 Spinner(sm)
  error: boolean;         // 에러 UI
}

// 액션형(폼/업로드)
interface ActionLoadingState {
  submitting: boolean;    // RecipeForm: 기존 `loading` 플래그 재사용 → 버튼 인라인 Spinner
  uploading: boolean;     // ImageUploader: 기존 `uploading` 재사용 → 슬롯 Spinner
}

// 전역 인증 게이트(이미 존재)
interface AuthGate {
  authLoading: boolean;   // AuthContext.loading: my-recipes 등에서 authLoading||loading로 스켈레톤
}
```

이 상태들은 **기존 화면에 이미 존재**한다(`page.tsx`의 `loading`/`loadingMore`/`error`, `RecipeForm`의 `loading`, `ImageUploader`의 `uploading`, `AuthContext`의 `loading`). 본 기능은 새 상태를 추가하지 않고, 이들 플래그를 인라인 마크업 대신 공용 컴포넌트로 **표시만 교체**한다.

### 서버 상태 (React Query / SWR)

**해당 없음 — 읽기/표시 전용 UI 프리미티브.** 본 기능은 서버 데이터를 페치하지 않는다(소비처가 기존 `fetch`로 관장). React Query/SWR을 도입하지 않으며, 기존 페칭 방식을 변경하지 않는다(§00 3.4 가산성).

### 낙관적 업데이트

**해당 없음 — 읽기 전용/표시 전용 기능.** 본 컴포넌트는 데이터를 변경하지 않으므로 낙관적 업데이트 대상이 아니다. (소비처의 낙관적 업데이트, 예: `FeedPost`의 좋아요 토글은 각 기능 관장.)

---

## 8. 에러 처리

본 컴포넌트 자체는 에러를 발생시키지 않는다(무상태·무네트워크). 아래는 **로딩 표시와 에러 상태의 전이 규약**이다 — 에러 발생 시 로딩 노드가 어떻게 정리되는지를 정의한다.

| 시나리오 | 에러코드/플래그 | 사용자 메시지 | 복구 전략 |
|----------|----------|--------------|----------|
| 초기 페치 실패 | `error = true` | 각 화면 EmptyState("레시피를 불러오지 못했어요" 등) | 스피너/스켈레톤 즉시 언마운트 → 에러 UI 표시 → 새로고침/재방문으로 재시도 |
| 추가 페치("더 보기") 실패 | catch(무플래그) | (조용히) 기존 콘텐츠 유지, "더 보기" 버튼 복구 | 인라인 스피너 제거(`finally`), 버튼 재활성 → 다시 클릭 |
| 폼 제출 실패 | API 4xx/5xx | RecipeForm 인라인 에러("저장에 실패했습니다.") | 인라인 스피너 제거, 버튼 재활성(`disabled=false`) → 수정 후 재제출 |
| 이미지 업로드 실패 | `/api/upload` 4xx/5xx | 업로드 슬롯 에러 표시(각 화면) | 슬롯 스피너 제거, input 재활성 → 파일 재선택 |
| 네트워크 오류 | NETWORK_ERROR | 위 각 영역의 에러 UI로 동일 처리 | 자동 재시도는 하지 않음(MVP). 사용자 수동 재시도. 무한 스피너 금지(반드시 `finally`에서 해제) |
| reduced-motion 환경의 에러 | — | 동일 에러 UI | 모션과 무관하게 에러 UI는 정적 표시 |

**불변 규약**: 모든 로딩 트리거는 응답/예외 처리 후 `finally`(또는 동등) 블록에서 로딩 플래그를 해제하여, 어떤 경우에도 스피너가 영구 회전 상태로 남지 않는다.

---

## 12. 테스트 계획

### 단위 테스트

| 테스트 ID | 대상 | 설명 | 기대 결과 |
|-----------|------|------|-----------|
| UT-01 | `Spinner` | `size="lg"` 렌더 | 외경 40px, ring 두 색 토큰(line/ink)만 사용 |
| UT-02 | `Spinner` | `label="이미지 생성 중"` | `sr-only` 텍스트에 라벨 노출, 루트 `role=status` |
| UT-03 | `Spinner` | 잘못된 `strokeWidth=0` | size별 기본 두께로 폴백 |
| UT-04 | `Skeleton` | `count={3}` | 막대 3개 렌더, 컨테이너 `role=status aria-busy` |
| UT-05 | `Skeleton` | `variant="block" aspectRatio="1 / 1"` | 정사각 박스 점유(height 미지정에도 면적 확보) |
| UT-06 | reduced-motion | media query mock `reduce` | spin/pulse 애니메이션 클래스/스타일 미적용 |

### 통합 테스트

| 테스트 ID | 시나리오 | 설명 | 기대 결과 |
|-----------|----------|------|-----------|
| IT-01 | 홈 피드 초기 로딩 | `/api/recipes` 지연 mock | 스켈레톤 표시 → 데이터 도착 시 `FeedPost`로 교체, `aria-busy` 해제 |
| IT-02 | "더 보기" 인라인 로딩 | nextCursor 존재 + 클릭 | 버튼 `disabled` + 인라인 `Spinner sm`, 완료 후 복구 |
| IT-03 | 폼 제출 | submit → 응답 지연 | 버튼 `disabled` + 인라인 스피너, 실패 시 복구 + 에러 메시지 |
| IT-04 | 이미지 업로드 | 파일 선택 → 업로드 지연 | 슬롯 스피너 + input `disabled`, 완료 시 썸네일 |
| IT-05 | CLS 측정 | 홈/상세 로딩→완료 | 누적 레이아웃 시프트 < 0.1(스켈레톤이 동일 박스 점유) |

### E2E 테스트

| 테스트 ID | 시나리오 | 스텝 |
|-----------|----------|------|
| E2E-01 | 전 화면 로딩 일관성 | 1. 홈 진입(스켈레톤 확인) → 2. 레시피 상세 진입(스켈레톤) → 3. 내 레시피(스켈레톤) → 4. 수정 페이지(중앙 스피너) → 모두 동일 `Spinner`/`Skeleton` 사용 확인(인라인 animate-pulse·평문 로딩 0건) |
| E2E-02 | reduced-motion 사용자 흐름 | 1. OS/브라우저 reduce-motion on → 2. 홈 로딩 → 회전·펄스 정지, 콘텐츠 정상 로드, 스크린리더 "불러오는 중" 안내 |

---

## 14. 복잡도 + MVP 범위

- **복잡도**: low~medium — 신규 로직/데이터/API 없음. 난도는 (1) 두 컴포넌트의 토큰·접근성·reduced-motion 정합성, (2) 다수 소비처의 **회귀 없는 점진 교체**, (3) CLS 방지를 위한 스켈레톤 박스 정합에 있다.

### MVP 포함 항목
- `Spinner.tsx`, `Skeleton.tsx` 신규 + `globals.css`에 `@keyframes spin` 및 reduced-motion 미디어쿼리 추가.
- 점진 교체: 홈 피드 초기/더보기, 레시피 상세, 내 레시피, 레시피 수정, 폼 제출, 이미지 업로드.
- 접근성(`role=status`/`aria-busy`/`sr-only label`) + reduced-motion 폴백 + CLS 방지.
- 02·05가 import만으로 소비 가능한 안정 props 시그니처(§3).

### Full 전용 항목 (MVP 제외)
- Next App Router `loading.tsx`/Suspense 스트리밍 기반 서버 스켈레톤 전환(MVP는 클라이언트 상태 교체에 집중).
- 결정적(determinate) 진행률 스피너(% 표시) — 현재 AI 호출은 진행률을 산출하지 않으므로 indeterminate ring으로 충분(02·05가 진행률을 제공하게 되면 확장).
- shimmer(그라데이션 스윕) 고급 스켈레톤 모션 — MVP는 기존 `animate-pulse` 톤 재사용으로 시각 연속성 우선.
- 콘텐츠별 전용 스켈레톤 컴포넌트(`FeedSkeleton` 등) 라이브러리화 — MVP는 `Skeleton` 프리미티브 조합으로 충분, 반복 시 추출.
