import "server-only";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { AiError } from "./errors";
import { assertAiCredentials } from "./auth";
import { withRetry } from "./retry";
import { type FetchLike } from "./extract/youtube";
import {
  extractRecipeTextFromVideo,
  defaultVisionGenerate,
  type VisionGenerate,
} from "./extract/youtube-vision";
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
  /** Stage 1: 영상 직접 분석(@ai-sdk/google 직결). */
  vision: VisionGenerate;
}

const rawFetch: RawFetch = (url, init) =>
  fetch(url, init as RequestInit) as unknown as ReturnType<RawFetch>;
// SSRF: 리다이렉트 hop마다 호스트를 재검증하는 가드된 fetcher.
const defaultFetcher: FetchLike = createGuardedFetcher(rawFetch);

export const defaultExtractDeps: ExtractDeps = {
  fetcher: defaultFetcher,
  vision: defaultVisionGenerate,
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

/** Stage 1 모델 순서: flash로 시도 후 부실하면 pro 폴백(spec §4). */
const VISION_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"] as const;

/**
 * YouTube 2단계 파이프라인: Stage 1(영상→자연어, @ai-sdk/google 직결) →
 * Stage 2(generateObject 구조화). flash로 시도해 재료/순서가 비면 pro로 1회 폴백한다.
 * 모든 시도가 실패하면 null(호출측이 noContent 처리) — 환각 저장을 차단한다.
 */
async function runYoutubeVision(
  url: string,
  deps: ExtractDeps
): Promise<ExtractRecipeResult | null> {
  for (const model of VISION_MODELS) {
    const vision = await extractRecipeTextFromVideo(url, { generate: deps.vision, model });
    if (!vision.ingested) continue; // 영상 미인제스트(시청 불가) → 다음 모델

    const content: UserContentPart[] = [
      {
        type: "text",
        text: `다음은 요리 영상을 분석한 내용입니다. 레시피로 구조화해주세요.\n\n${vision.text.slice(
          0,
          MAX_SOURCE_CHARS
        )}`,
      },
    ];
    const { object } = await withRetry(() =>
      deps.generate({ messages: [{ role: "user", content }] })
    );
    const recipe = postProcessRecipe(object as RawRecipe) as AiRecipe;

    if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
      console.log(
        `[ai/recipe] method=youtube-vision model=${model} inputTokens=${vision.inputTokens}`
      );
      return {
        recipe,
        sourceType: "youtube",
        confidence: computeConfidence(recipe),
        partial: isPartial(recipe),
        missingFields: computeMissingFields(recipe),
        ingestion: { method: "youtube-vision", inputTokens: vision.inputTokens },
      };
    }
    // 재료/순서 부실 → 다음 모델(pro) 재시도
  }
  return null;
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

export type ExtractMethod = "jsonld" | "youtube-vision" | "web-text";

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

  // YouTube: 2단계(Vision→Structure). 영상을 직접 보고 구조화. 실패 시 noContent.
  if (sourceType === "youtube") {
    const result = await runYoutubeVision(url, deps);
    if (!result) {
      throw new AiError(
        "noContent",
        "영상에서 레시피를 찾지 못했습니다(영상 비공개/분석 실패)."
      );
    }
    return result;
  }

  // Web: 본문/JSON-LD 텍스트 추출 후 generateObject.
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

  const content = buildWebContent(article);
  const { object, usage } = await withRetry(() =>
    deps.generate({ messages: [{ role: "user", content }] })
  );
  const inputTokens = usage?.inputTokens ?? null;
  console.log(`[ai/recipe] method=web-text inputTokens=${inputTokens}`);

  const recipe = postProcessRecipe(object as RawRecipe) as AiRecipe;

  const allEmpty =
    !recipe.title.trim() && recipe.ingredients.length === 0 && recipe.steps.length === 0;
  if (allEmpty) throw new AiError("noContent", "레시피 콘텐츠 부족");

  return {
    recipe,
    sourceType,
    confidence: computeConfidence(recipe),
    partial: isPartial(recipe),
    missingFields: computeMissingFields(recipe),
    ingestion: { method: "web-text", inputTokens },
  };
}
