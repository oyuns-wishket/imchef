import "server-only";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { AiError } from "./errors";
import { assertAiCredentials } from "./auth";
import { withRetry } from "./retry";
import {
  parseYoutubeVideoId,
  fetchYoutubeTranscript,
  type FetchLike,
} from "./extract/youtube";
import {
  fetchArticle,
  serializeRecipeJsonLd,
  jsonLdToRecipe,
  type ArticleContent,
} from "./extract/web";
import { createGuardedFetcher, type RawFetch } from "./extract/safe-fetch";
import { postProcessRecipe, type RawRecipe } from "./postprocess";

// 이슈 #8: 영상/장문 이해력을 위해 flash → pro 승급.
export const GEMINI_RECIPE_MODEL = "google/gemini-2.5-pro" as const;

// 자막/본문 텍스트 입력 길이 상한(토큰/비용 폭증 방지).
export const MAX_SOURCE_CHARS = 12000;

// ─── Zod 스키마 (.describe few-shot 가이드) ─────────────────────────────────────

const ingredientSchema = z.object({
  name: z.string().min(1).describe("재료 이름만. 예: 돼지고기, 고추장, 대파"),
  amount: z.string().default("").describe('수량 문자열. 예: "300", "2", "약간". 없으면 빈 문자열'),
  unit: z
    .string()
    .default("")
    .describe('단위. g, kg, ml, L, 컵, 큰술, 작은술, 개, 알, 장, 줌, 꼬집 중 하나 또는 빈 문자열'),
});

const stepSchema = z.object({
  content: z.string().min(1).describe("한 조리 단계의 본문. 배열 순서가 곧 조리 순서다"),
});

export const aiRecipeSchema = z.object({
  title: z
    .string()
    .default("")
    .describe("한국어 요리명만. 영어 병기·홍보 수식어·따옴표 금지. 예: 제육볶음"),
  description: z.string().default("").describe("2~3문장 이내 한 줄 소개"),
  servings: z.number().int().min(1).max(99).default(1).describe("인분 수. 미상이면 1"),
  cookTime: z
    .number()
    .int()
    .min(0)
    .max(1440)
    .nullable()
    .default(null)
    .describe("분 단위 정수. 1시간→60. 미상이면 null"),
  difficulty: z
    .enum(["easy", "normal", "hard"])
    .default("normal")
    .describe("초보/쉬움→easy, 중급/보통→normal, 고급/어려움→hard"),
  ingredients: z.array(ingredientSchema).default([]).describe("재료 목록"),
  steps: z.array(stepSchema).default([]).describe("조리 순서 배열(순서대로)"),
});

export type AiRecipe = z.infer<typeof aiRecipeSchema>;

// ─── URL 유형 판별 ─────────────────────────────────────────────────────────────

export type SourceType = "youtube" | "web";

export function classifyUrl(url: string): SourceType | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const isYoutube =
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "m.youtube.com" ||
    host.endsWith(".youtube.com");
  return isYoutube ? "youtube" : "web";
}

// ─── 프롬프트 ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 요리 레시피 추출 전문가입니다.
주어진 콘텐츠(유튜브 자막/영상 또는 웹 페이지 본문)에서 레시피 정보를 정확히 추출해 구조화 JSON으로 반환하세요.

규칙:
- title: 한국어 요리명만. 영어 병기·홍보 수식어("많은 분들이 좋아하는")·따옴표 금지. (X)"제육볶음 (Jeyuk-bokkeum recipe)" (O)"제육볶음"
- description: 2~3문장 이내 한 줄 소개
- servings: 인분 수(정수), 명시 없으면 1
- cookTime: 분 단위 정수(예: "1시간"→60), 불명확하면 null
- difficulty: 초보/쉬움→easy, 중급/보통→normal, 고급/어려움→hard, 불명확하면 normal
- ingredients: 각 항목 {name, amount, unit}. 단위는 g/kg/ml/L/컵/큰술/작은술/개/알/장/줌/꼬집 또는 빈 문자열
- steps: 조리 순서를 순서대로 content 배열에 담기
- 콘텐츠에 레시피가 없으면 ingredients와 steps를 빈 배열로
- 모든 텍스트는 한국어로`;

// ─── 의존성 주입 (테스트 가능) ─────────────────────────────────────────────────

// 영상 폴백 폐기 후 입력은 사전추출 텍스트만(자막/본문) 사용한다.
type UserContentPart = { type: "text"; text: string };

export interface GenerateObjectResultLite {
  object: AiRecipe;
  usage?: { inputTokens?: number };
}

export interface ExtractDeps {
  generate: (input: { messages: { role: "user"; content: UserContentPart[] }[] }) => Promise<GenerateObjectResultLite>;
  fetcher: FetchLike;
}

const rawFetch: RawFetch = (url, init) =>
  fetch(url, init as RequestInit) as unknown as ReturnType<RawFetch>;
// SSRF: 리다이렉트 hop마다 호스트를 재검증하는 가드된 fetcher.
const defaultFetcher: FetchLike = createGuardedFetcher(rawFetch);

export const defaultExtractDeps: ExtractDeps = {
  fetcher: defaultFetcher,
  generate: async ({ messages }) => {
    const { object, usage } = await generateObject({
      model: GEMINI_RECIPE_MODEL,
      schema: aiRecipeSchema,
      system: SYSTEM_PROMPT,
      messages,
    });
    return { object, usage: { inputTokens: usage?.inputTokens } };
  },
};

// ─── 신뢰도 / 부분추출 판정 (순수) ──────────────────────────────────────────────

export function computeMissingFields(recipe: AiRecipe): string[] {
  const missing: string[] = [];
  if (!recipe.title.trim()) missing.push("title");
  if (recipe.ingredients.length === 0) missing.push("ingredients");
  if (recipe.steps.length === 0) missing.push("steps");
  return missing;
}

export function isPartial(recipe: AiRecipe): boolean {
  return recipe.ingredients.length === 0 || recipe.steps.length === 0;
}

export function computeConfidence(recipe: AiRecipe): number {
  const signals = [
    recipe.title.trim() !== "",
    recipe.description.trim() !== "",
    recipe.servings >= 1,
    recipe.cookTime !== null,
    recipe.ingredients.length > 0,
    recipe.steps.length > 0,
  ];
  return signals.filter(Boolean).length / signals.length;
}

// ─── 입력 정규화: 콘텐츠 → 텍스트(또는 영상 폴백) ──────────────────────────────

/**
 * 유튜브 자막을 텍스트로 추출한다. 자막이 없으면(비공개/봇차단/지역잠금) noContent로
 * 정직하게 실패시킨다. 영상 직접전달 폴백은 SDK 계약상 동작하지 않아(URL 문자열은
 * base64로 오해석, watch 페이지는 mp4 아님) 폐기했다 — 환각 추출보다 명시적 실패가 안전.
 */
async function buildYoutubeInput(url: string, deps: ExtractDeps): Promise<UserContentPart[]> {
  const videoId = parseYoutubeVideoId(url);
  const transcript = videoId
    ? await fetchYoutubeTranscript(videoId, { fetcher: deps.fetcher }).catch(() => "")
    : "";

  if (!transcript.trim()) {
    throw new AiError(
      "noContent",
      "유튜브 자막을 추출하지 못했습니다(자막 비공개/봇차단/지역잠금 가능)."
    );
  }

  return [
    {
      type: "text",
      text: `다음은 유튜브 요리 영상의 자막입니다. 레시피를 추출해주세요.\n\n${transcript.slice(
        0,
        MAX_SOURCE_CHARS
      )}`,
    },
  ];
}

function buildWebContent(article: ArticleContent): UserContentPart[] {
  const structured = article.jsonLd ? serializeRecipeJsonLd(article.jsonLd) : "";
  const body = [structured, article.title, article.text]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_SOURCE_CHARS);
  return [
    {
      type: "text",
      text: `다음은 웹 페이지에서 추출한 레시피 콘텐츠입니다. 레시피를 추출해주세요.\n\n${body}`,
    },
  ];
}

/** JSON-LD가 재료·조리순서를 모두 담고 있으면 결정론적으로 변환(모델 우회). */
export function jsonLdFastPath(article: ArticleContent): AiRecipe | null {
  if (!article.jsonLd) return null;
  const direct = jsonLdToRecipe(article.jsonLd);
  if (direct.ingredients.length > 0 && direct.steps.length > 0) {
    return postProcessRecipe(direct) as AiRecipe;
  }
  return null;
}

// ─── 핵심 추출 함수 ───────────────────────────────────────────────────────────

export type ExtractMethod = "jsonld" | "transcript" | "web-text";

export interface ExtractRecipeResult {
  recipe: AiRecipe;
  sourceType: SourceType;
  confidence: number;
  partial: boolean;
  missingFields: string[];
  ingestion: {
    /** 추출 경로. jsonld=모델우회, transcript=유튜브 자막, web-text=웹 본문 모델. */
    method: ExtractMethod;
    inputTokens: number | null;
  };
}

export async function extractRecipeFromUrl(
  url: string,
  deps: ExtractDeps = defaultExtractDeps
): Promise<ExtractRecipeResult> {
  assertAiCredentials();

  const sourceType = classifyUrl(url);
  if (!sourceType) throw new AiError("unsupported", "미지원 URL 유형");

  // 1) 입력 정규화(자막/본문 사전추출). 유튜브 자막 실패는 buildYoutubeInput에서 noContent.
  let content: UserContentPart[];
  let method: ExtractMethod;
  if (sourceType === "youtube") {
    content = await buildYoutubeInput(url, deps);
    method = "transcript";
  } else {
    const article = await fetchArticle(url, { fetcher: deps.fetcher });

    // web fast-path: 구조화 데이터(JSON-LD)가 완전하면 모델 호출 없이 결정론적 변환.
    const fast = jsonLdFastPath(article);
    if (fast) {
      console.log("[ai/recipe] method=jsonld (model bypass)");
      return {
        recipe: fast,
        sourceType,
        confidence: computeConfidence(fast),
        partial: isPartial(fast),
        missingFields: computeMissingFields(fast),
        ingestion: { method: "jsonld", inputTokens: null },
      };
    }
    content = buildWebContent(article);
    method = "web-text";
  }

  // 2) 추출(일시 오류 재시도)
  const { object, usage } = await withRetry(() =>
    deps.generate({ messages: [{ role: "user", content }] })
  );
  const inputTokens = usage?.inputTokens ?? null;
  console.log(`[ai/recipe] method=${method} inputTokens=${inputTokens}`);

  // 3) 후처리(완성도 보정)
  const recipe = postProcessRecipe(object as RawRecipe) as AiRecipe;

  // 4) 콘텐츠 부족 판정
  const allEmpty =
    !recipe.title.trim() && recipe.ingredients.length === 0 && recipe.steps.length === 0;
  if (allEmpty) throw new AiError("noContent", "레시피 콘텐츠 부족");

  return {
    recipe,
    sourceType,
    confidence: computeConfidence(recipe),
    partial: isPartial(recipe),
    missingFields: computeMissingFields(recipe),
    ingestion: { method, inputTokens },
  };
}
