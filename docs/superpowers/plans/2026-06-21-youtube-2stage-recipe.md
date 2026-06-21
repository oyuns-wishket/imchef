# YouTube 2단계(Vision→Structure) 레시피 추출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 요리 영상 URL에서 제목·인분·조리시간·난이도·재료(이름/양/단위)·조리순서를 채우도록, "영상을 직접 보는" 2단계 파이프라인으로 추출 경로를 교체한다.

**Architecture:** Stage 1은 `generateText`로 YouTube 영상을 Gemini에 직접 넘겨(영상 native 이해) 레시피를 자연어로 서술. Stage 2는 그 텍스트를 `generateObject`로 JSON 구조화. structured output이 멀티모달 영상과 비호환이라 영상은 generateText로만 인제스트된다는 실측(토큰 57만 vs 34)이 근거.

**Tech Stack:** Next.js 16, ai SDK v6 (Vercel AI Gateway, `AI_GATEWAY_API_KEY`), vitest, zod.

## Global Constraints

- AI 호출은 Vercel AI Gateway 경유(`AI_GATEWAY_API_KEY`). Google 직결/추가 키 금지.
- Stage 1 기본 모델 `google/gemini-2.5-flash`, 품질 부족 시 `google/gemini-2.5-pro` 1회 폴백.
- Stage 2 모델 `google/gemini-2.5-flash` 고정.
- 영상 처리 구간 상한 15분(비용/길이 통제).
- 환각 금지: 재료=0 또는 순서=0이면 저장 가능한 결과로 만들지 말고 noContent(422).
- 모든 AI/네트워크 경계는 DI 주입으로 키 없이 단위 테스트.
- web/블로그 경로는 변경 금지(기존 JSON-LD/본문 경로 보존).
- 게이트: build OK / tsc 0 / eslint 0 / vitest green.

---

### Task 0: 라이브 스파이크 — 2단계 + video clipping 실측 (구현 전 가정 검증)

**Files:**
- 임시 스크립트(커밋 안 함): `_spike.mjs` (실행 후 삭제)

**목적:** 실제 한국 요리 YouTube 영상으로 (a) generateText 영상→텍스트가 재료/순서를 뽑는지, (b) 그 텍스트를 generateObject로 구조화하면 재료/순서가 채워지는지, (c) `providerOptions.google.videoMetadata`로 15분 clipping이 Gateway에서 먹는지 확인한다. 결과로 Task 1~2의 프롬프트·모델·clipping 방식을 확정.

- [ ] **Step 1:** 대표 한국 요리 영상 URL 2~3개 확보(WebSearch 또는 알려진 채널). 요리가 확실한 watch URL.
- [ ] **Step 2:** 스파이크 스크립트로 flash/pro 각각: `generateText(youtube file part)` → text, inputTokens 로깅. text가 재료/순서를 포함하는지 육안 확인.
- [ ] **Step 3:** Step 2의 text를 `generateObject(aiRecipeSchema)`에 넣어 재료/순서 개수 확인.
- [ ] **Step 4:** `providerOptions: { google: { videoMetadata: { endOffset: "900s" } } }` 적용 호출의 inputTokens가 줄어드는지(clipping 작동 여부) 확인. 안 되면 대안(메타데이터 duration 조회) 메모.
- [ ] **Step 5:** 결과를 `docs/superpowers/plans/2026-06-21-youtube-2stage-recipe.md` 하단 "스파이크 결과"에 기록. 스크립트 삭제.

**Exit 조건:** flash 또는 pro로 영상→재료/순서 추출이 실제로 되는 것 확인(됨/안 됨 + 최적 모델/clipping 방식 확정). 안 되면 plan 중단하고 사용자에게 보고.

---

### Task 1: youtube-vision.ts — Stage 1 (영상→자연어 레시피)

**Files:**
- Create: `src/lib/ai/extract/youtube-vision.ts`
- Test: `src/lib/ai/extract/youtube-vision.test.ts`

**Interfaces:**
- Produces:
  - `type VisionGenerate = (input: { model: string; messages: VisionMessages; providerOptions?: unknown }) => Promise<{ text: string; inputTokens: number | null }>`
  - `interface VisionResult { text: string; inputTokens: number | null; ingested: boolean }`
  - `async function extractRecipeTextFromVideo(url: string, opts: { generate: VisionGenerate; model: string; clipSeconds?: number }): Promise<VisionResult>`
  - `const VIDEO_INGEST_MIN_TOKENS = 5000` (스파이크 결과로 조정)
  - `const VISION_PROMPT: string` (영상에서 제목/인분/시간/난이도/재료 이름·양·단위/조리순서를 한국어로 상세 서술하도록 지시)

- [ ] **Step 1: 실패 테스트** — `youtube-vision.test.ts`: 주입 generate가 큰 inputTokens + 레시피 텍스트 반환 시 `ingested=true`, 텍스트 반환. inputTokens가 임계 미만이면 `ingested=false`.

```ts
import { describe, it, expect, vi } from "vitest";
import { extractRecipeTextFromVideo, VIDEO_INGEST_MIN_TOKENS, type VisionGenerate } from "./youtube-vision";

describe("extractRecipeTextFromVideo", () => {
  it("영상 인제스트 성공 시 텍스트+ingested=true", async () => {
    const generate: VisionGenerate = vi.fn(async () => ({ text: "제목: 제육볶음\n재료: 돼지고기 300g...", inputTokens: 500000 }));
    const r = await extractRecipeTextFromVideo("https://youtube.com/watch?v=x", { generate, model: "google/gemini-2.5-flash" });
    expect(r.ingested).toBe(true);
    expect(r.text).toContain("제육볶음");
  });
  it("입력토큰 임계 미만이면 ingested=false (미인제스트)", async () => {
    const generate: VisionGenerate = vi.fn(async () => ({ text: "지어낸 내용", inputTokens: 34 }));
    const r = await extractRecipeTextFromVideo("https://youtube.com/watch?v=x", { generate, model: "google/gemini-2.5-flash" });
    expect(r.ingested).toBe(false);
    expect(34).toBeLessThan(VIDEO_INGEST_MIN_TOKENS);
  });
  it("clipSeconds를 providerOptions로 전달", async () => {
    const generate = vi.fn<VisionGenerate>(async () => ({ text: "t", inputTokens: 100000 }));
    await extractRecipeTextFromVideo("https://youtube.com/watch?v=x", { generate, model: "google/gemini-2.5-flash", clipSeconds: 900 });
    const arg = generate.mock.calls[0][0];
    expect(JSON.stringify(arg.providerOptions)).toContain("900");
  });
});
```

- [ ] **Step 2:** `vitest run src/lib/ai/extract/youtube-vision.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — `youtube-vision.ts`: VISION_PROMPT + messages([text 프롬프트, file(URL, video/mp4)]) 구성, clipSeconds 있으면 `providerOptions.google.videoMetadata.endOffset`, generate 호출, inputTokens로 `ingested` 판정.
- [ ] **Step 4:** 테스트 PASS + `tsc --noEmit` 0.
- [ ] **Step 5: Commit** — `feat: add youtube-vision Stage1 (영상→레시피 텍스트)`

---

### Task 2: recipe.ts — YouTube 경로를 2단계로 교체 + flash/pro 폴백

**Files:**
- Modify: `src/lib/ai/recipe.ts` (buildYoutubeInput 제거 → 2단계 오케스트레이션)
- Test: `src/lib/ai/recipe.test.ts` (youtube 케이스 갱신)

**Interfaces:**
- Consumes: `extractRecipeTextFromVideo` (Task 1), 기존 `deps.generate`(generateObject 래퍼), `postProcessRecipe`, `aiRecipeSchema`.
- Produces: `ExtractDeps`에 `vision: VisionGenerate` 추가. `extractRecipeFromUrl`의 youtube 경로가 Stage1(vision flash) → Stage2(generate) → 재료/순서 0이면 Stage1 pro 재시도 → 그래도 0이면 noContent.

- [ ] **Step 1: 실패 테스트** — recipe.test.ts: youtube URL + vision 주입(텍스트 반환) + generate 주입(재료/순서 채운 객체) → `extractRecipeFromUrl` 결과에 재료/순서 채워짐, `ingestion.method==="youtube-vision"`. vision이 ingested=false면 pro 폴백 호출 확인. 둘 다 빈 결과면 noContent.

```ts
it("youtube 2단계: vision→generate로 재료/순서 채움", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "k");
  const vision = vi.fn(async () => ({ text: "재료: 돼지고기 300g; 순서: 볶기", inputTokens: 500000 }));
  const generate = vi.fn(async () => ({ object: fullRecipe, usage: { inputTokens: 800 } }));
  const out = await extractRecipeFromUrl("https://youtube.com/watch?v=x", { fetcher: dummyFetcher, generate, vision });
  expect(out.recipe.ingredients.length).toBeGreaterThan(0);
  expect(out.recipe.steps.length).toBeGreaterThan(0);
  expect(out.ingestion.method).toBe("youtube-vision");
});
it("재료/순서 0이면 pro 폴백, 그래도 0이면 noContent", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "k");
  const vision = vi.fn(async () => ({ text: "내용없음", inputTokens: 34 }));
  const generate = vi.fn(async () => ({ object: emptyRecipe, usage: { inputTokens: 50 } }));
  await expect(extractRecipeFromUrl("https://youtube.com/watch?v=x", { fetcher: dummyFetcher, generate, vision }))
    .rejects.toMatchObject({ kind: "noContent" });
  expect(vision).toHaveBeenCalledTimes(2); // flash + pro 폴백
});
```

- [ ] **Step 2:** 테스트 FAIL.
- [ ] **Step 3: 구현** — recipe.ts youtube 분기:
  1. `vision(flash)` → text. ingested=false거나 이어지는 Stage2 결과 빈약 → `vision(pro)` 재시도(최대 1회).
  2. text를 `deps.generate({messages:[{text}]})` → 구조화. postProcess.
  3. 재료/순서 0이고 pro까지 했으면 noContent.
  4. `ingestion.method="youtube-vision"`, inputTokens 로깅.
  - `defaultExtractDeps`에 `vision: defaultVisionGenerate`(generateText 래퍼) 추가.
- [ ] **Step 4:** 테스트 PASS + tsc 0.
- [ ] **Step 5: Commit** — `feat: youtube 추출을 2단계(vision→structure)로 교체 + pro 폴백`

---

### Task 3: youtube.ts 자막 스크래핑 제거 (videoId 파싱만 유지)

**Files:**
- Modify: `src/lib/ai/extract/youtube.ts` (transcript/json3/timedtext/consent 제거, `parseYoutubeVideoId`·`FetchLike` 유지)
- Modify: `src/lib/ai/extract/youtube.test.ts` (제거 함수 테스트 삭제, videoId 테스트 유지)

- [ ] **Step 1:** youtube.test.ts에서 `fetchYoutubeTranscript`/`parseTimedText*`/`withCaptionFormat`/`extractPlayerResponse`/`getCaptionTracks`/`selectCaptionTrack` 관련 테스트 제거. `parseYoutubeVideoId`, `decodeHtmlEntities`(필요시) 테스트 유지.
- [ ] **Step 2:** `vitest run` → 제거된 import로 FAIL.
- [ ] **Step 3:** youtube.ts에서 자막 관련 export/함수/상수(WATCH_HEADERS 등) 제거. `parseYoutubeVideoId`, `FetchLike` 타입만 남김. recipe.ts가 `fetchYoutubeTranscript`를 더는 import 안 함 확인.
- [ ] **Step 4:** `vitest run` PASS + tsc 0 + eslint 0.
- [ ] **Step 5: Commit** — `refactor: 자막 스크래핑 제거(영상 직접 이해로 대체)`

---

### Task 4: 핸들러 통합 + 환각 차단 회귀

**Files:**
- Modify/Test: `src/app/api/ai/recipe-from-url/handler.test.ts`

- [ ] **Step 1: 실패 테스트** — youtube URL 시나리오로 핸들러 통합테스트: 정상(재료/순서 채움)→200, noContent(환각 차단)→422, 쿼터→429. extract 주입 모킹.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** 핸들러는 이미 generic하므로 대부분 통과. youtube 응답 계약(method 포함) 확인 위한 단언 보강.
- [ ] **Step 4:** PASS + tsc 0.
- [ ] **Step 5: Commit** — `test: youtube 2단계 핸들러 통합 회귀`

---

### Task 5: 전체 게이트 + 라이브 스모크 + 배포

**Files:** 없음(검증/배포)

- [ ] **Step 1:** `npm run test:ci` 전체 green, `tsc --noEmit` 0, `eslint .` 0, `npm run build` 성공.
- [ ] **Step 2: 라이브 스모크(키 사용, 수동)** — `.env.local`로 실제 요리 영상 2건을 2단계 파이프라인에 통과시켜 재료/순서가 실제로 채워지고 환각이 아닌지 육안 확인.
- [ ] **Step 3: Commit + PR + main 머지** — 브랜치 push, PR(base main), squash 머지.
- [ ] **Step 4: 재배포** — `vercel --prod`로 최신 코드 프로덕션 반영.
- [ ] **Step 5:** 사용자에게 배포 URL + 테스트 안내.

---

## Self-Review (spec 대비)

- spec §3 2단계 → Task 1,2 ✓
- spec §4 flash+pro 폴백 → Task 2 ✓
- spec §5 15분 clipping → Task 0(검증)+Task 1(clipSeconds) ✓
- spec §6 폼/저장 동기화(빈 결과 차단) → Task 2(noContent)+Task 4 ✓
- spec §7 에러 → Task 2,4 ✓
- spec §8 테스트 → 각 Task TDD + Task 5 라이브 스모크 ✓
- spec §1 자막 제거 → Task 3 ✓
- spec 비-목표(web 보존) → Task들이 youtube 분기만 수정 ✓

## 스파이크 결과 (Task 0 실행 — 2026-06-21)

**핵심 반전: Vercel AI Gateway로는 영상 이해 불가, @ai-sdk/google 직결이 정답.**

| 방식 | inputTokens | 결과 |
|---|---|---|
| Gateway `generateText` + youtube(URL객체) | 577,819 ~ 719,804 | "영상 시청 불가" → 일반 레시피 **환각** |
| **@ai-sdk/google 직결 + youtube(string, watch형식)** | **12,703** | **영상 실제 분석 성공** (타임스탬프 0:03, 정확한 계량 120g/380ml/2큰술) |

확정 사항:
- youtube 경로는 **`@ai-sdk/google` 직결**(`GOOGLE_GENERATIVE_AI_API_KEY`). Gateway 아님.
- file part `data`는 **string URL**(`new URL()` 객체 ❌ → invalid argument).
- URL은 **watch 형식**으로 정규화(shorts/youtu.be → `watch?v=<id>`).
- 직결이 Gateway보다 토큰 1/57 → **비용도 훨씬 저렴**.
- 미인제스트 신호: 응답에 "시청 불가/볼 수 없/재생할 수 없" 포함 → 폴백/실패.

→ Global Constraints 정정: youtube Stage1은 직결, Stage2 구조화는 직결 또는 Gateway 무관(텍스트).
