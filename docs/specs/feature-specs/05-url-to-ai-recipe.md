---
title: "URL→AI 레시피 자동생성"
stage: "feature-spec"
depends-on:
  - "docs/specs/00-feature-delta-plan.md"
created-at: 2026-06-20
status: draft
---

# 기능 05: URL→AI 레시피 자동생성

> 새 레시피 등록 화면에서 유튜브/블로그 등 URL을 입력받아, Gemini(Vercel AI Gateway 경유)가 콘텐츠를 분석해 레시피 폼 필드를 자동으로 채워준다. AI 결과는 어디까지나 **초안(draft)** 이며, 사용자는 등록 전 모든 필드를 자유롭게 수정할 수 있다.

## 1. 개요

- **해결하는 문제**: 사용자가 유튜브 요리 영상이나 블로그 레시피를 보고 Imchef에 옮겨 적으려면, 제목·소개·인분·조리시간·난이도·재료(이름/양/단위) N개·조리순서 N단계를 모두 손으로 타이핑해야 한다. 평균적인 레시피 1건 입력에 재료 8~12개 + 조리순서 6~10단계 수기 입력이 필요해 **레시피 1건당 5~12분의 입력 노동**이 발생하고, 그 부담 때문에 "보기만 하고 등록하지 않는" 이탈이 잦다. 또한 단위 표기(g/ml/큰술/T 등)가 사람마다 제각각이라 데이터 일관성도 떨어진다.
- **제공하는 가치**:
  - URL 1개 붙여넣기 + 버튼 1번으로 폼 대부분을 자동 채움 → **레시피 등록 소요 시간을 5~12분에서 30~90초(검토·수정 포함)로 단축**(약 80% 절감 목표).
  - 단위 정규화·기본값 보정으로 **재료/단위 데이터 일관성 향상**.
  - "보고 끝나던" 콘텐츠를 손쉽게 자산화 → 레시피 등록 전환율 상승.
- **범위**:
  - **다루는 것**:
    - 새 레시피 등록 화면(`RecipeForm`)에 URL 입력 + "링크 등록하고 AI 레시피 자동생성" 진입 액션.
    - 신규 서버 라우트 `POST /api/ai/recipe-from-url` — URL을 받아 Gemini 멀티모달(URL context / YouTube 이해)로 구조화 레시피 JSON 추출.
    - 추출 결과를 `RecipeForm`의 `useState` 폼 상태에 prefill(병합 전략 포함), 사용자 수정.
    - 미래지향(Gemini 스타일) 분석 로딩 연출(공유 §3.2 로딩 표준 위에 ink 그라데이션/스캔 모션).
    - 5가지 화면 상태 처리(Empty/Loading/Partial/Error/Ideal).
  - **다루지 않는 것**:
    - AI 이미지 생성(기능 02 — AI 이미지 생성).
    - 로딩 공용 컴포넌트(`Spinner`/`Skeleton`)의 정의 자체(기능 03 — 스켈레톤+로딩 시스템). 본 기능은 그 위에 연출만 더한다.
    - 실제 레시피 영속화(`POST /api/recipes`) — 기존 등록 동작 그대로 사용(본 기능은 폼 채움까지).
    - 디자인 시안 5종의 최종 시각 결정(공유 §3.3 — 빌드 단계 frontend-design 산출물).
    - URL 외 입력원(이미지 OCR, 텍스트 붙여넣기 등) — 차후 확장.

## 2. 사용자 스토리 + 인수 조건

### US-1: URL로 레시피 폼 자동 채우기
As a **로그인한 사용자**, I want **유튜브/블로그 URL을 붙여넣고 "링크 등록하고 AI 레시피 자동생성"을 누르면 AI가 폼을 자동으로 채워주기를**, so that **수기 입력 노동 없이 빠르게 레시피를 등록한다**

**인수 조건:**
- [ ] AC-1-1: 새 레시피 등록 화면 상단(이미지 업로더 아래·제목 입력 위)에 URL 입력 필드와 라벨이 정확히 **"링크 등록하고 AI 레시피 자동생성"** 인 진입 버튼이 노출된다.
- [ ] AC-1-2: URL 미입력 또는 형식이 URL이 아닌 상태에서 버튼은 `disabled`이며, 클릭해도 호출되지 않는다.
- [ ] AC-1-3: 유효 URL 입력 후 버튼 클릭 시 `POST /api/ai/recipe-from-url`을 호출하고, 응답 성공 시 제목·소개·인분·조리시간·난이도·재료(name/amount/unit)·조리순서(steps)·참고링크(=입력 URL)가 폼 상태에 prefill된다.
- [ ] AC-1-4: prefill 후 모든 필드는 기존과 동일하게 **편집 가능**해야 하며, 사용자가 수정한 값이 보존된 채로 기존 `레시피 등록`(`POST /api/recipes`) 흐름으로 저장된다.
- [ ] AC-1-5: 참고링크 필드가 비어 있으면 입력 URL을 참고링크로 자동 채운다(이미 값이 있으면 덮어쓰지 않는다).

### US-2: 미래지향 분석 로딩 피드백
As a **사용자**, I want **AI가 URL을 분석하는 동안 진행 중임이 분명한 세련된 로딩을 보기를**, so that **응답을 기다리는 동안 멈춘 게 아닌지 불안하지 않다**

**인수 조건:**
- [ ] AC-2-1: 호출 시작과 동시에 폼 상단 영역에 미래지향 로딩(원형 프로그레스 + 스캔 모션, ink 계열 그라데이션)이 나타나고, 진입 버튼은 비활성+로딩 라벨로 바뀐다.
- [ ] AC-2-2: 로딩 중에는 새 팔레트/컬러 액센트를 도입하지 않고 흑백 ink 토큰(`--color-ink`/`--color-line`/그 그라데이션)만 사용한다.
- [ ] AC-2-3: 분석 진행 단계 텍스트("링크 여는 중 → 콘텐츠 분석 중 → 레시피 정리 중")가 순차 노출되어 진행감을 준다(실제 단계 매핑 또는 타이머 기반 연출 허용).
- [ ] AC-2-4: 로딩 중 동일 버튼 재클릭이나 폼 다른 영역 조작으로 인한 **중복 호출이 차단**된다.

### US-3: 부분 추출 / 실패에 대한 안전한 처리
As a **사용자**, I want **AI가 일부만 추출했거나 실패했을 때 무엇이 비었는지/왜 실패했는지 명확히 알기를**, so that **빈칸을 직접 채우거나 다른 URL로 재시도할 수 있다**

**인수 조건:**
- [ ] AC-3-1: 응답에 일부 필드만 있거나 신뢰도가 낮으면(예: 재료 0건, 조리순서 0단계) 추출된 필드만 채우고, **비어 있는 필수 영역(재료/조리순서)에 "AI가 이 부분을 찾지 못했어요. 직접 입력해주세요" 안내**를 표시한다.
- [ ] AC-3-2: 분석 실패/미지원 URL/쿼터 초과/서버 오류 시 폼 데이터를 훼손하지 않고(기존 입력 보존) 사용자 친화 에러 메시지 + "다시 시도" 액션을 제공한다(§8 매핑).
- [ ] AC-3-3: AI 키 미설정(`AI_GATEWAY_API_KEY` 부재) 시 진입 버튼은 노출하되, 클릭 시 "지금은 AI 자동생성을 사용할 수 없어요. 직접 입력해주세요" 안내로 폴백하고 수기 입력은 정상 동작한다.
- [ ] AC-3-4: 폼에 이미 사용자가 입력한 값이 있는 상태에서 자동생성을 실행하면, 빈 폼이 아니므로 **덮어쓰기 전에 확인**을 거친다(§7 병합 전략).

> 본 기능은 목록/표(DataTable)·관리자/프로필(ProfileMenu)·계층/트리(TreeView) 유형에 해당하지 않으므로 US-G/US-P/US-T는 적용하지 않는다.

## 3. UI/UX 명세

### 컴포넌트 계층
```
RecipeForm (기존, "use client")
├── UrlRecipeImport (신규)              # URL 입력 + 자동생성 진입 + 로딩/에러 표현
│   ├── input[type=url] ("영상/블로그 링크를 붙여넣어 주세요")
│   ├── Button ("링크 등록하고 AI 레시피 자동생성", variant: primary)
│   ├── FuturisticAnalyzeLoader (조건부)  # 03 Spinner + 스캔 모션 연출
│   │   ├── Spinner (ui/Spinner, 원형 프로그레스)
│   │   └── StageText ("링크 여는 중 / 콘텐츠 분석 중 / 레시피 정리 중")
│   └── ImportNotice (조건부)            # Partial 안내 / Error 메시지 + "다시 시도"
├── ImageUploader (기존)
├── input(title) / textarea(description) (기존, prefill 대상)
├── servings / cookTime / difficulty (기존, prefill 대상)
├── IngredientInput (기존, prefill 대상)
├── StepInput (기존, prefill 대상)
└── input(referenceUrl) (기존, prefill 대상)
```

> `UrlRecipeImport`는 prefill 결과를 콜백(`onFill(data, mode)`)으로 `RecipeForm`에 올려주고, `RecipeForm`이 기존 `useState` setter로 병합한다. 폼 상태의 단일 소유권은 `RecipeForm`이 유지한다(가산성/기존 시그니처 보존).

### 5가지 화면 상태
| 상태 | 조건 | UI 표현 | 사용자 액션 |
|------|------|---------|------------|
| Empty | URL 입력 전(import 상태 = idle) | URL 입력 필드(placeholder "영상/블로그 링크를 붙여넣어 주세요") + 비활성 "링크 등록하고 AI 레시피 자동생성" 버튼. 폼은 빈 기본값. | URL 붙여넣기 |
| Loading | 분석 중(analyzing) | URL 영역 위에 미래지향 로더(ink 그라데이션 원형 프로그레스 + 좌→우 스캔 라인 모션) + 단계 텍스트 순차 표시. 버튼은 "분석 중..."로 비활성. 폼 입력은 dim 처리(읽기 가능, 편집은 대기). | 대기(취소는 MVP 제외, 페이지 이탈 가능) |
| Partial | 응답은 성공이나 일부 필드만/저신뢰(재료 0 또는 조리순서 0 또는 confidence < 임계) | 추출된 필드는 채워지고, 비어있는 필수 영역에 점선 보더 + 안내 캡션("AI가 이 부분을 찾지 못했어요. 직접 입력해주세요"). 상단에 노란 톤 없이 ink-soft 텍스트로 "일부만 자동 채웠어요" 캡션. | 빈칸 직접 입력, 다른 URL로 다시 시도 |
| Error | 분석 실패/미지원 URL/쿼터/네트워크/키 부재(error) | URL 영역 아래 `ImportNotice`: ink 라인 보더 박스 + 에러 메시지 + "다시 시도" 버튼. 폼은 기존 값 그대로 보존(미훼손). | 다시 시도, 직접 입력 전환 |
| Ideal | 모든 핵심 필드 추출 성공(filled) | 제목·소개·인분·조리시간·난이도·재료·조리순서·참고링크가 채워진 정상 폼. 상단에 "AI가 자동으로 채웠어요 — 자유롭게 수정하세요" ink-soft 캡션. | 필드 수정, 이미지 추가, "레시피 등록" |

### 반응형 대응
- **Mobile (< 768px)**: URL 입력과 버튼을 세로 스택(버튼 full-width). 로더는 폼 폭 내 카드. 단계 텍스트는 1줄.
- **Tablet (768px ~ 1024px)**: URL 입력 + 버튼을 한 줄(`flex`), 버튼 우측 정렬. 로더는 입력 줄 아래 배너.
- **Desktop (> 1024px)**: Tablet과 동일 구성, 입력 폭 확대. 로더 원형 프로그레스 크기 한 단계 키움.

### 인터랙션 상세
| 인터랙션 | 동작 |
|----------|------|
| URL 입력 | 입력값 trim + 즉시 URL 형식 검증(`new URL()` 시도)으로 버튼 enable/disable 토글. 디바운스 200ms. |
| "링크 등록하고 AI 레시피 자동생성" 클릭 | 폼이 비어있지 않으면 확인 다이얼로그(§7) → 진행. 진행 시 import 상태 idle→analyzing, 로더 fade-in(`rise` 키프레임 재사용), 버튼 비활성. |
| 분석 완료 | analyzing→filled(또는 partial). 채워진 필드는 `pop` 키프레임으로 미세 강조. 로더 fade-out. |
| 분석 실패 | analyzing→error. `ImportNotice` slide-down 표시(`slide-down` 키프레임). |
| "다시 시도" | error→analyzing 재호출(동일 URL). |
| 중복 클릭 | analyzing 동안 버튼/엔터 입력 무시(in-flight 가드). |

### 시각 디자인 스펙 (해당 시)
> 시각 최종값은 빌드 단계 frontend-design 5개 시안 산출물(공유 §3.3). 여기서는 토큰 제약만 고정한다.

| 요소 | 배경/트랙 | 진행/전경 | 비고 |
|------|----------|----------|------|
| 원형 프로그레스 트랙 | `--color-line` | — | 기능 03 Spinner 토큰 |
| 원형 프로그레스 진행 | — | `--color-ink` | conic/linear ink 그라데이션 허용 |
| 스캔 라인 모션 | 투명 | `--color-ink`→투명 그라데이션 | 좌→우 sweep, 새 팔레트 금지 |
| ImportNotice 박스 | `glass` | `--color-edge` 1px 보더 | 에러도 빨강 도입 없이 ink 라인 + 텍스트로 표현(기존 error 텍스트는 예외적 red-500 유지) |
| 미입력/저신뢰 필드 강조 | — | `--color-line` 점선 보더 | dashed 1px |

## 4. 데이터 모델

본 기능은 **기존 Prisma 스키마로 충분하며 추가 스키마가 필수가 아니다.** AI 추출 결과는 그대로 기존 `RecipeFormData` 형태로 변환되어 기존 `POST /api/recipes`가 `Recipe`/`RecipeIngredient`/`RecipeStep`/`RecipeImage`를 생성한다. AI 추출 단계 자체는 영속화하지 않는다(서버 라우트는 스테이트리스 추출기).

### (선택, MVP 제외) AI 출처 추적 컬럼 — EXPAND-only
운영상 "AI로 생성된 레시피" 분석/필터가 필요해질 경우에 한해, 공유 §3.4(EXPAND-only) 원칙에 따라 `Recipe`에 **nullable 컬럼만** 추가 제안한다. MVP에서는 추가하지 않는다.

| 필드명 | 타입 | 제약조건 | 인덱스 | 설명 |
|--------|------|----------|--------|------|
| sourceUrl | String? | nullable | (선택) | AI 자동생성에 사용된 원본 URL. 수기 입력 시 null |
| aiGenerated | Boolean? | nullable, DEFAULT null | — | AI 초안 기반 등록 여부(true/null) |

> 추가 시에도 기존 컬럼 drop/rename/NOT NULL 강화 없음. 기존 `POST /api/recipes`는 두 필드를 받지 않아도 동작(추가 필드는 optional). 도입 결정은 빌드 단계로 이연.

## 5. API 명세

### POST /api/ai/recipe-from-url
입력 URL(유튜브/블로그 등)을 Gemini 멀티모달(URL context / YouTube 이해)로 분석해 폼 필드 형태의 구조화 레시피 JSON을 추출한다. **server-only**(AI 호출은 `src/lib/ai/gemini.ts`에 캡슐화, 키는 클라이언트 비노출). **로그인 필수**(iron-session 패턴, 미인증 401). AI SDK v6 `generateObject` + Zod 스키마로 구조화 추출.

**요청:**
```typescript
interface RecipeFromUrlRequest {
  url: string;        // 분석 대상 URL. http(s) 절대 URL. 서버에서 재검증
}
```

**응답 200:**
```typescript
// 폼 필드 형태(RecipeFormData와 동형) — 클라이언트는 그대로 폼 상태에 병합
interface RecipeFromUrlResponse {
  recipe: {
    title: string;                  // 추출 제목(빈 문자열 가능)
    description: string;            // 소개(없으면 "")
    servings: number;               // 인분, 기본 1
    cookTime: number | null;        // 분 단위, 미상이면 null
    difficulty: "easy" | "normal" | "hard"; // 미상이면 "normal"
    ingredients: { name: string; amount: string; unit: string }[]; // 정규화된 단위
    steps: { content: string }[];   // 조리순서(순서대로)
    referenceUrl: string;           // 입력 URL(가능 시 그대로)
  };
  meta: {
    sourceType: "youtube" | "web";  // URL 유형 판별 결과
    confidence: number;             // 0~1 추출 신뢰도(부분추출 판단용)
    partial: boolean;               // 재료/조리순서 중 비어있는 핵심 필드 존재 여부
    missingFields: string[];        // 예: ["ingredients", "steps"]
  };
}
```

**Zod 검증 스키마(서버, generateObject 대상):**
```typescript
import { z } from "zod";

const ingredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),            // "200", "2", "약간" 등 문자열
  unit: z.string().default(""),              // 정규화 단위(아래 §6)
});

const stepSchema = z.object({
  content: z.string().min(1),
});

// AI가 채우는 구조화 레시피 (generateObject schema)
export const aiRecipeSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  servings: z.number().int().min(1).max(99).default(1),
  cookTime: z.number().int().min(0).max(1440).nullable().default(null),
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
});

// 요청 본문 검증
export const requestSchema = z.object({
  url: z.string().url(),
});
```

**에러 코드:**
| 코드 | 상황 | 메시지 |
|------|------|--------|
| 400 | `url` 누락/형식 불량(Zod url 실패) | "올바른 링크를 입력해주세요." |
| 401 | 미인증(session.userId 없음) | "로그인이 필요합니다." |
| 415 | 미지원 URL 유형(허용 호스트/스킴 외, 또는 명백히 비콘텐츠 URL) | "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요." |
| 422 | 분석은 됐으나 레시피로 볼 콘텐츠 부족(제목·재료·조리순서 모두 빈약) | "이 링크에서 레시피를 찾지 못했어요. 직접 입력해주세요." |
| 429 | AI 게이트웨이 쿼터/레이트리밋 초과 | "요청이 많아요. 잠시 후 다시 시도해주세요." |
| 500 | AI 호출/파싱 예외, 키 부재(`AI_GATEWAY_API_KEY` 없음) | "AI 분석에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요." |

> 키 부재는 서버에서 명시적으로 감지해 500(또는 503) + 위 메시지로 폴백하고, 클라이언트는 AC-3-3 안내로 처리한다. `handleApiError`(기존 `src/lib/api`) 패턴과 일관되게 로깅한다.

## 6. 비즈니스 로직

### 핵심 로직 상세

**1) URL 유형 판별 (서버)**
| 조건 | sourceType | 분석 방식 |
|------|-----------|----------|
| host가 `youtube.com`/`youtu.be`/`m.youtube.com`/`*.youtube.com`(watch/shorts/live) | youtube | Gemini YouTube 영상 이해(영상 URL을 멀티모달 입력으로 전달) |
| 그 외 http(s) 웹 페이지(블로그 등) | web | Gemini URL context(웹 콘텐츠 가져와 분석) |
| http(s) 외 스킴 / 명백한 비콘텐츠(파일 다운로드 등) | — | 415 반환 |

**2) 추출 필드 매핑 / 기본값**
| 폼 필드 | 매핑 규칙 | 기본값 |
|---------|----------|--------|
| title | 영상/글 제목 또는 요리명 | "" (Partial 안내 대상 아님, 사용자 입력) |
| description | 한 줄 소개/요약(2~3문장 이내) | "" |
| servings | 명시 인분 파싱, 미상이면 1 | 1 |
| cookTime | 분 단위 정수로 환산("1시간"→60), 미상이면 null | null |
| difficulty | 난이도 언급 매핑(초보/쉬움→easy, 중급/보통→normal, 고급/어려움→hard), 미상이면 normal | normal |
| ingredients[] | {name, amount, unit}로 분해, 단위 정규화 | [] (비면 Partial) |
| steps[] | 순서대로 content 배열 | [] (비면 Partial) |
| referenceUrl | 입력 URL(클라이언트에서 빈 경우에만 주입) | 입력 URL |

**3) 단위 정규화 (서버, generateObject 프롬프트 + 후처리)**
- 무게: `그램/그람/g` → `g`, `킬로그램/kg` → `kg`.
- 부피: `밀리리터/ml` → `ml`, `리터/L` → `L`, `컵` → `컵`.
- 조리 계량: `큰술/스푼/T/tbsp` → `큰술`, `작은술/티스푼/t/tsp` → `작은술`.
- 개수/기타: `개/알/장/줌/꼬집/약간/적당량` → 그대로 유지.
- 분해 불가(예: "소금 약간")이면 `amount="약간"`, `unit=""`로 둔다. 빈 단위는 허용(폼 단위 기본 `g`는 사용자가 조정).

**4) 부분 추출 처리**
- `partial = (ingredients.length === 0) || (steps.length === 0)`.
- `confidence`는 추출 충실도 휴리스틱(필드 채움 비율 + 모델 자기평가)로 산출. `confidence < 0.4`이면 partial로 간주해 클라이언트가 Partial 상태로 표시.
- 모든 핵심(title·ingredients·steps) 빈약 → 422.

**5) 사용자 수정 우선 (AI 결과 = 초안)**
- 추출 결과는 폼에 prefill될 뿐 자동 저장되지 않는다. 저장은 기존 `POST /api/recipes`가 검증(제목/재료/조리순서 필수).
- prefill 후 사용자가 수정한 값이 최종값. AI는 사용자 입력을 사후에 덮어쓰지 않는다.

### 유효성 검사
| 필드 | 규칙 | 에러 메시지 |
|------|------|------------|
| url(클라이언트) | trim 후 `new URL()` 성공 + http(s) | "올바른 링크를 입력해주세요." (버튼 비활성으로 사전 차단) |
| url(서버) | Zod `z.string().url()` + 스킴 http(s) | 400 |
| host 유형 | youtube/web 판별, 그 외 415 | 415 메시지 |
| 추출 결과 | aiRecipeSchema 통과 + 핵심 콘텐츠 존재 | 422(콘텐츠 부족) |

### 엣지케이스
- **케이스 1 (입력 중 폼이 비어있지 않음)**: 사용자가 일부 필드를 이미 입력한 뒤 자동생성 실행 → 빈 폼이 아니므로 "AI 결과로 폼을 채우면 입력하신 내용을 덮어쓸 수 있어요. 진행할까요?" 확인 다이얼로그. 취소 시 호출하지 않음(§7 병합 전략과 연동).
- **케이스 2 (부분 추출 / 단위 누락)**: 재료는 추출됐으나 양/단위가 비어있는 항목 → 해당 항목은 name만 채우고 amount/unit 빈칸으로 두어 사용자가 보완. 조리순서 0건이면 StepInput 영역에 안내.
- **케이스 3 (미지원/접근 불가 URL)**: 로그인 담장/지역 차단/삭제된 영상 등으로 콘텐츠 접근 실패 → 422 또는 415로 분기, 폼 데이터 미훼손, "다시 시도"/"직접 입력" 제공.
- **케이스 4 (느린 분석 / 타임아웃)**: 응답 지연 시 서버 타임아웃(예: 30~45s) 후 500. 클라이언트는 in-flight 가드로 중복 호출 방지, 타임아웃 시 에러 상태 + 재시도.
- **케이스 5 (쿼터/키 부재)**: 429 또는 키 부재 폴백(§5). 진입점은 유지하되 수기 입력 경로는 항상 가용.

## 7. 상태 관리

### 클라이언트 상태
```typescript
type ImportStatus = "idle" | "analyzing" | "filled" | "partial" | "error";

interface UrlImportState {
  url: string;                 // 입력 URL(trim 전 raw)
  status: ImportStatus;        // idle/analyzing/filled/partial/error
  stageIndex: number;          // 로딩 단계 텍스트 인덱스(0:링크 여는 중 …)
  errorCode: number | null;    // 400/415/422/429/500/401 등
  errorMessage: string;        // 사용자 메시지(§8)
  missingFields: string[];     // partial일 때 비어있는 핵심 필드
  inFlight: boolean;           // 중복 호출 가드
}
```

> `RecipeForm`의 기존 폼 `useState`(title/description/servings/cookTime/difficulty/ingredients/steps/imageUrls/referenceUrl)는 그대로 유지하고, `UrlRecipeImport`는 위 import 상태만 별도 보유한 뒤 `onFill`로 병합한다.

### 서버 상태 (React Query / SWR)
**해당 없음 — 캐시 대상 아님.** AI 분석은 사용자 트리거 1회성 mutation이며 동일 URL 재호출(다시 시도)도 사용자 명시 액션이다. `fetch` 기반 명령형 호출로 충분하다(기존 `RecipeForm`이 `fetch`를 직접 쓰는 컨벤션과 일치). 별도 useQuery/캐시 키 없음.

### prefill 병합 전략
```
isFormEmpty = title/description 공백 && servings===1 && cookTime===""
            && difficulty==="normal" && ingredients 모두 빈 name
            && steps 모두 빈 content && referenceUrl 공백

if (isFormEmpty)           → 전체 덮어쓰기(추출값으로 setState)
else                        → 확인 다이얼로그
     ├─ 확인               → 전체 덮어쓰기
     └─ 취소               → 병합 안 함(현재 입력 유지)
referenceUrl 예외           → 비어있을 때만 입력 URL 주입(다른 필드 정책과 무관)
빈 추출 필드               → 덮어쓰지 않음(예: cookTime null이면 기존 값 보존)
```
- 핵심 원칙: **빈 폼이면 덮어쓰기, 입력 중이면 확인**. AI는 사용자 입력을 임의로 손상시키지 않는다.

### 낙관적 업데이트
- **해당 없음** — AI 분석은 서버 결과를 받아 채우는 동작이라 낙관적 선반영 대상이 아니다. 단, 로딩 단계 텍스트는 클라이언트 타이머로 선행 연출(실제 진행과 무관한 UX 장치).

## 8. 에러 처리
| 시나리오 | 에러코드 | 사용자 메시지 | 복구 전략 |
|----------|----------|--------------|----------|
| URL 형식 불량 | 400 | "올바른 링크를 입력해주세요." | 입력 정정(버튼은 형식 통과 전까지 비활성) |
| 미인증 | 401 | "로그인이 필요합니다." | 로그인 페이지로 안내, 입력 URL은 폼에 보존 |
| 미지원 URL 유형 | 415 | "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요." | 다른 URL 입력 / 직접 입력 전환 |
| 레시피 콘텐츠 부족 | 422 | "이 링크에서 레시피를 찾지 못했어요. 직접 입력해주세요." | 직접 입력, 다른 URL 시도 |
| 쿼터/레이트리밋 | 429 | "요청이 많아요. 잠시 후 다시 시도해주세요." | "다시 시도"(지수 백오프 권장), 직접 입력 |
| 네트워크 오류 | NETWORK_ERROR | "네트워크 연결을 확인해주세요." | "다시 시도" 버튼(폼 데이터 보존) |
| AI 호출 실패/파싱 오류 | 500 | "AI 분석에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요." | "다시 시도", 직접 입력 |
| AI 키 부재 | 500/503 | "지금은 AI 자동생성을 사용할 수 없어요. 직접 입력해주세요." | 수기 입력으로 즉시 폴백(진입점 유지) |

> 모든 에러에서 **기존 폼 데이터는 훼손되지 않는다**(AC-3-2). 에러는 `UrlRecipeImport` 영역 내 `ImportNotice`에 표시하고, 폼 본문은 평소처럼 편집 가능하다.

## 9. 페이지 내 연관 기능
> 새 레시피 등록 화면(`RecipeForm`)에는 본 기능 외 이미지 업로드/AI 이미지 생성(기능 02)이 공존한다.

| 기능명 | 상호작용 방식 | 데이터 공유 |
|--------|-------------|------------|
| AI 이미지 생성(기능 02) | 별개 진입점. URL 자동생성은 텍스트 필드만 채우고 이미지는 건드리지 않음. 사용자가 이후 AI 이미지 생성으로 사진 추가 가능 | `imageUrls`는 본 기능이 수정하지 않음(독립) |
| 이미지 업로더(기존) | prefill과 무관하게 사용자가 직접 사진 업로드 | `imageUrls` 공유하나 본 기능 미사용 |
| 레시피 등록 저장(기존 `POST /api/recipes`) | prefill·수정된 폼 상태를 그대로 저장. 본 기능은 저장 흐름을 변경하지 않음 | 전체 폼 상태 공유 |

## 11. 이미지 에셋 요구사항
| 용도 | 설명 | 방법 | 프롬프트/URL |
|------|------|------|-------------|
| 자동생성 진입 버튼 아이콘 | "AI/마법" 뉘앙스 라인 아이콘(예: sparkle/wand) | 기존 `icons.tsx` SVG 세트에 추가(흑백 라인, 1px) | 신규 SVG export(컬러 액센트 없음) |
| 미래지향 로더 모션 | 원형 프로그레스 + 스캔 라인 | CSS/SVG 모션(에셋 불필요) | 키프레임(`rise`/신규 sweep), ink 그라데이션 |

## 12. 테스트 계획

### 단위 테스트
| 테스트 ID | 대상 | 설명 | 기대 결과 |
|-----------|------|------|-----------|
| UT-01 | URL 유형 판별 | youtube.com/youtu.be/shorts → youtube, 블로그 → web, ftp/file → 415 분기 | sourceType 정확 분류 |
| UT-02 | 단위 정규화 | "200그램"→g, "2큰술"→큰술, "소금 약간"→amount="약간",unit="" | 정규화 규칙대로 변환 |
| UT-03 | aiRecipeSchema 파싱 | 누락 필드 입력 시 기본값(servings=1, difficulty=normal, cookTime=null) 적용 | 안전 파싱, 예외 없음 |
| UT-04 | partial 판정 | ingredients=[] 또는 steps=[] → partial=true, missingFields 채움 | 정확한 partial/missingFields |
| UT-05 | prefill 병합 | 빈 폼=덮어쓰기, 입력 폼=확인 경유, referenceUrl 비었을 때만 주입 | 병합 전략 준수 |

### 통합 테스트
| 테스트 ID | 시나리오 | 설명 | 기대 결과 |
|-----------|----------|------|-----------|
| IT-01 | 정상 추출(web) | 블로그 URL → 200 + 폼형 응답 | recipe 전 필드 + meta.partial=false |
| IT-02 | 콘텐츠 부족 | 레시피 아닌 URL → 422 | 422 + 메시지, 폼 미훼손 |
| IT-03 | 미인증 | 세션 없이 호출 → 401 | 401 "로그인이 필요합니다." |
| IT-04 | 키 부재 | `AI_GATEWAY_API_KEY` 미설정 → 폴백 | 500/503 + 키부재 메시지(키 비노출) |
| IT-05 | 쿼터 | 게이트웨이 429 전파 | 429 + 재시도 안내 |

### E2E 테스트
| 테스트 ID | 시나리오 | 스텝 |
|-----------|----------|------|
| E2E-01 | 빈 폼 자동생성 성공 | 1. 로그인 → 2. 새 레시피 → 3. URL 붙여넣기 → 4. "링크 등록하고 AI 레시피 자동생성" 클릭 → 5. 로더 확인 → 6. 폼 prefill 확인 → 7. 일부 수정 → 8. "레시피 등록" → 9. 상세 페이지 이동 |
| E2E-02 | 입력 중 덮어쓰기 확인 | 1. 제목 직접 입력 → 2. 자동생성 클릭 → 3. 확인 다이얼로그 노출 → 4. 취소 시 기존 값 유지 / 확인 시 덮어쓰기 |
| E2E-03 | 부분 추출 안내 | 1. 조리순서 누락 URL 분석 → 2. 추출 필드 채움 + StepInput 영역 안내 표시 → 3. 사용자 직접 보완 후 등록 |
| E2E-04 | 실패 후 직접 입력 | 1. 미지원/실패 URL → 2. 에러 + "다시 시도" 노출 → 3. 직접 입력으로 정상 등록 |

## 14. 복잡도 + MVP 범위
- **복잡도**: **high** — 근거: (1) 외부 AI(멀티모달 URL/YouTube 이해) 연동 + Vercel AI Gateway 경유로 비결정적 출력, (2) `generateObject` + Zod 구조화 추출 및 단위 정규화·부분추출 휴리스틱, (3) prefill 병합/사용자 입력 보호 상태 로직, (4) 5상태 UI + 미래지향 로딩 연출, (5) 다양한 에러/쿼터/키부재/타임아웃 처리. 외부 의존·비결정성·상태복잡도가 모두 높음.

### MVP 포함 항목
- URL 입력 + "링크 등록하고 AI 레시피 자동생성" 진입(라벨 고정).
- `POST /api/ai/recipe-from-url`(youtube/web 판별, generateObject + Zod, 단위 정규화, 기본값 보정).
- 폼 prefill + 병합 전략(빈 폼 덮어쓰기 / 입력 중 확인 / referenceUrl 조건 주입).
- 5상태 UI + 미래지향 로딩(03 표준 위 ink 연출).
- 에러/쿼터/키부재/타임아웃 처리(§8), 로그인 필수(401), server-only.

### Full 전용 항목
- `Recipe.sourceUrl`/`aiGenerated` 추적 컬럼(§4 선택) — MVP 데이터 변경 없음 원칙으로 제외.
- 분석 취소(abort) 버튼 — MVP는 in-flight 가드만, 취소는 차후.
- 다중 URL/일괄 가져오기, 텍스트 붙여넣기/이미지 OCR 입력원 확장.
- 추출 신뢰도 시각화(필드별 confidence 배지) 고도화.
- 결과 캐싱(동일 URL 재분석 비용 절감) — 현재 캐시 미적용.
