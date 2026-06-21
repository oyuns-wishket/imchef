---
title: "YouTube 레시피 추출 재설계 — 2단계 Vision→Structure"
stage: "feature-spec"
depends-on:
  - "docs/specs/feature-specs/05-url-to-ai-recipe.md"
  - "docs/specs/00-feature-delta-plan.md"
created-at: 2026-06-21
status: draft
supersedes-youtube-path-of: "05-url-to-ai-recipe.md"
---

# 기능 06: YouTube 레시피 추출 재설계 (2단계 Vision→Structure)

> 기능 05(URL→AI 레시피)의 **YouTube 경로**를 재설계한다. 현재 제목만 채워지고
> 재료·조리순서가 비는 근본 버그를 실측으로 규명하고, "영상을 실제로 보는" 2단계
> 파이프라인으로 교체한다. 웹/블로그 경로는 기존 동작을 유지한다.

## 1. 배경 — 실측으로 규명한 근본 원인

기능 05 구현 후에도 배포 환경에서 **YouTube URL 입력 시 제목만 채워지고 재료·조리순서가
빈 칸**으로 남는 문제가 지속됐다. 2026-06-21 Vercel 프로덕션의 실제 `AI_GATEWAY_API_KEY`로
직접 실측한 결과:

| 호출 방식 | 입력 토큰 | 의미 |
|---|---|---|
| `generateText` + YouTube file part | **577,819** | 영상이 실제로 인제스트됨(프레임+오디오) |
| `generateObject` + YouTube file part | **34** | 영상 미인제스트 → 모델이 재료/순서를 **환각** |

**결론**: Vercel AI Gateway는 YouTube 영상을 정상적으로 native 이해한다. 문제는
**`generateObject`(structured output, JSON 강제) 모드가 멀티모달 영상 입력과 호환되지
않는다**는 것이다. structured output 모드에서는 file part(YouTube)가 무시되고, 모델은
영상을 보지 않은 채(토큰 34) 그럴듯한 레시피를 지어낸다(환각). 이것이 이슈 #8의
"입력토큰 ~53"의 정체다.

기능 05가 시도한 자막 스크래핑 우회는 (1) Vercel 서버리스 IP의 YouTube 봇차단 위험,
(2) 화면 정보(계량컵·자막 오버레이) 손실이라는 한계가 있었다. **영상을 직접 보는
`generateText` 경로가 본질적으로 우월**하며, 추가 비용 없이(기존 Gateway 키) 동작한다.

### 비-목표(Non-goals)
- 웹/블로그 경로 재설계 — 기존 JSON-LD fast-path + 본문 텍스트 경로 유지(이미 동작).
- Google AI Studio 직결(`@ai-sdk/google`) 도입 — 불필요(Gateway로 충분). 별도 키/결제 없음.
- 영상 자막 스크래핑 — **폐기**(youtube.ts의 transcript 경로 제거).

## 2. 목표 & 성공 기준

YouTube 요리 영상 URL 1개로 **제목 · 인분 · 조리시간 · 난이도 · 재료(이름/양/단위) ·
조리순서** 6요소가 폼에 채워지고, 사용자가 등록까지 완료할 수 있다.

- **성공 정의(1건)**: 한 요리 영상에서 위 6요소 중 **제목·재료·조리순서 3대 필수**가 모두
  채워지고(재료 ≥1, 순서 ≥1), 인분/시간/난이도는 영상에 정보가 있으면 채워진다.
- **환각 금지**: 영상 미인제스트(입력토큰 비정상) 시 재료/순서를 지어내지 않고 명시적
  실패로 처리한다.
- **측정**: 대표 한국 요리 YouTube 영상(Shorts/일반) 골든셋으로 6요소 충족률 측정.

## 3. 아키텍처 — 2단계 파이프라인

```
YouTube URL
  │  classifyUrl → "youtube"
  ▼
[Stage 1: Vision]  generateText
  model: gemini-2.5-flash (기본)  ── 품질 부족 판정 시 → gemini-2.5-pro 재시도(폴백)
  content: [ text(추출 지시 프롬프트), file(YouTube URL, video/mp4) ]
  providerOptions: 영상 처리 구간 상한(비용/길이 통제, §5)
  → 자연어 레시피 서술(제목/인분/시간/난이도/재료/순서를 상세 텍스트로)
  → usage.inputTokens 로깅 + 인제스트 검증(임계 미만이면 미인제스트 판정)
  │
  ▼
[Stage 2: Structure]  generateObject
  model: gemini-2.5-flash
  schema: aiRecipeSchema (기존 재사용)
  input: Stage 1 자연어 텍스트 (텍스트 입력 → structured output 정상 작동)
  → 구조화 JSON { title, servings, cookTime, difficulty, ingredients[], steps[] }
  │
  ▼
[후처리]  postProcessRecipe (기존 재사용)
  title 정제, 단위 정규화, 단계 정렬, 빈 항목 제거
  │
  ▼
[검증 게이트]
  재료=0 또는 순서=0 → noContent(422) 명시 실패("영상에서 레시피를 찾지 못했어요")
  (환각 저장 차단)
  │
  ▼
응답 { recipe(6요소+referenceUrl), meta(sourceType, partial, missingFields, method:"youtube-vision") }
  → 폼 prefill → 사용자 수정 → POST /api/recipes 저장
```

### 컴포넌트 경계 (단일 책임)
| 모듈 | 책임 | 비고 |
|---|---|---|
| `src/lib/ai/extract/youtube-vision.ts` (신규) | Stage 1: 영상→자연어 레시피. 모델 폴백·인제스트 검증·길이 통제 | DI(generateText 주입)로 테스트 |
| `src/lib/ai/recipe.ts` (수정) | 오케스트레이션: youtube→2단계, web→기존 경로. Stage 2 구조화 | 기존 web 경로 보존 |
| `src/lib/ai/extract/youtube.ts` (정리) | videoId 파싱만 유지. **자막 스크래핑(transcript) 제거** | parseYoutubeVideoId 등 순수 함수 유지 |
| `aiRecipeSchema`, `postProcessRecipe` | 기존 재사용 | 변경 없음 |

## 4. 모델 정책 (flash 기본 + pro 폴백)

- **Stage 1 기본**: `gemini-2.5-flash` (영상 이해 + 저비용).
- **품질 부족 판정 → `gemini-2.5-pro` 1회 재시도**:
  - 판정 기준: Stage 1 텍스트가 비거나, Stage 2 구조화 후 **재료 0 또는 순서 0**, 또는
    Stage 1 입력토큰이 영상 대비 비정상적으로 낮음(미인제스트 의심).
  - pro 재시도도 실패하면 noContent(422)로 정직하게 실패.
- **Stage 2**: `gemini-2.5-flash` 고정(텍스트 구조화는 flash로 충분).

## 5. 비용 & 영상 길이 통제

- 영상 입력은 토큰이 크다(Shorts ~57만). **기본 flash로 영상 1건당 대략 수백 원 이하**.
- **15분 초과 영상 차단**: 영상 길이를 사전 확보하기 어려운 환경(Vercel 봇차단)을 고려해
  2-레이어로 처리한다.
  1. **Gemini video clipping**(`providerOptions.google.videoMetadata`로 처리 구간을
     0~15분으로 상한) → 모델이 처음 15분만 인제스트(길이·비용 동시 통제, duration 사전조회 불필요).
  2. (best-effort) 메타데이터로 duration 확보 가능하면 15분 초과 시 사전 안내("긴 영상은
     앞부분만 분석돼요" 또는 차단). 확보 실패 시 1)의 clipping으로 보장.
- `maxDuration` 라우트 설정(긴 영상 분석 대비, 기존 60s 유지 또는 상향).

## 6. 데이터 / 저장 동기화 (협의 강화)

기존 Prisma 스키마로 충분(추가 없음). 단 **AI 출력↔폼↔저장의 계약을 강화**해
"빈 채로 통과"를 막는다.

- 추출 결과는 기능 05와 동일한 `RecipeFormData` 형태로 폼에 prefill.
- **필수 보장**: 재료/조리순서가 없으면 저장 단계 이전에 명확히 안내(현재 RecipeForm
  validation이 재료/순서 1개 이상을 요구 — 유지). AI가 빈 결과를 줬을 때 사용자가 "왜
  비었는지" 알 수 있게 partial/실패 메시지를 명확화.
- (선택, EXPAND-only) `Recipe.sourceUrl`/`aiGenerated` 추적 컬럼 — MVP 제외(기능 05 §4와 동일).

## 7. 에러 처리

| 시나리오 | 코드 | 사용자 메시지 | 비고 |
|---|---|---|---|
| 영상 미인제스트(토큰 비정상) + pro 폴백도 실패 | 422 | "이 영상에서 레시피를 찾지 못했어요. 직접 입력해주세요." | 환각 저장 차단 |
| 미지원 URL(youtube 아님은 web 경로로) | — | — | classifyUrl 분기 |
| 재생 불가/비공개/삭제 영상 | 422 | 위와 동일 | Stage 1이 "재생 불가" 응답 시 |
| 쿼터/레이트리밋 | 429 | "요청이 많아요. 잠시 후 다시 시도해주세요." | 기존 AiError 분류 |
| 키 부재 | 500 | "지금은 AI 자동생성을 사용할 수 없어요. 직접 입력해주세요." | OIDC/키 가드 |

## 8. 테스트 계획

- **단위(결정론)**: videoId 파싱, 인제스트 검증 판정(토큰 임계), 모델 폴백 트리거 판정,
  Stage1 텍스트→Stage2 구조화 매핑(텍스트 픽스처 기반), 후처리 — 전부 DI 모킹으로 키 없이.
- **통합(모킹)**: youtube 경로 핸들러 — 정상/미인제스트→폴백→422/쿼터429/키부재500.
- **라이브 스모크(키 보유 시, 수동)**: 대표 한국 요리 YouTube 영상 3건으로 2단계 end-to-end —
  재료/순서가 실제로 채워지고 환각이 아닌지 확인. (CI 비포함, 키 의존)
- 기존 web 경로 테스트 회귀 유지.

## 9. 복잡도 & MVP 범위

- **복잡도**: medium-high (멀티모달 영상 + 2단계 + 폴백 + 비용/길이 통제).
- **MVP 포함**: youtube 2단계(Vision→Structure), flash+pro 폴백, 15분 clipping, 인제스트
  검증, 환각 차단, 자막 스크래핑 제거, 기존 web 경로 보존.
- **Full 전용**: duration 정밀 사전조회, 영상 구간 사용자 선택, 다국어 자막 병합, 결과 캐싱.

## 10. 마이그레이션 / 롤백

- `youtube.ts`의 transcript 함수 제거는 **YouTube 경로를 2단계로 교체한 뒤** 수행(점진).
- 롤백: Stage 1을 끄면 기존 web-text 경로로 폴백 가능하도록 분기 보존.
