import "server-only";
import { generateObject } from "ai";
import { z } from "zod/v4";

// Vercel AI Gateway 경유 Gemini 멀티모달 모델
export const GEMINI_RECIPE_MODEL = "google/gemini-2.5-flash" as const;

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const ingredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
  unit: z.string().default(""),
});

const stepSchema = z.object({
  content: z.string().min(1),
});

export const aiRecipeSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  servings: z.number().int().min(1).max(99).default(1),
  cookTime: z.number().int().min(0).max(1440).nullable().default(null),
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
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
주어진 URL(유튜브 영상 또는 웹 페이지)에서 레시피 정보를 추출하여 구조화된 JSON으로 반환하세요.

규칙:
- title: 요리명/레시피 제목
- description: 2~3문장 이내의 한 줄 소개
- servings: 인분 수(정수), 명시 없으면 1
- cookTime: 분 단위 정수(예: "1시간" → 60), 불명확하면 null
- difficulty: 초보/쉬움→"easy", 중급/보통→"normal", 고급/어려움→"hard", 불명확하면 "normal"
- ingredients: 재료 목록. 각 항목은 {name, amount, unit}.
  단위 정규화: 그램/g→"g", 킬로그램→"kg", 밀리리터/ml→"ml", 리터→"L", 컵→"컵",
  큰술/스푼/T/tbsp→"큰술", 작은술/티스푼/t/tsp→"작은술",
  개/알/장/줌/꼬집/약간/적당량 그대로, 분해 불가이면 amount="약간" unit=""
- steps: 조리 순서 배열, 순서대로 content 문자열
- 레시피 내용이 없으면 ingredients와 steps를 빈 배열로 반환하세요
- 모든 텍스트는 한국어로`;

// ─── 핵심 추출 함수 ───────────────────────────────────────────────────────────

export interface ExtractRecipeResult {
  recipe: AiRecipe;
  sourceType: SourceType;
  confidence: number;
  partial: boolean;
  missingFields: string[];
}

export async function extractRecipeFromUrl(
  url: string
): Promise<ExtractRecipeResult> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const sourceType = classifyUrl(url);
  if (!sourceType) {
    throw Object.assign(new Error("미지원 URL 유형"), { code: 415 });
  }

  const userContent: Array<{ type: "text"; text: string } | { type: "file"; data: URL; mediaType: string }> = [
    {
      type: "text",
      text: `다음 URL의 레시피 정보를 추출해주세요: ${url}`,
    },
    {
      type: "file",
      data: new URL(url),
      mediaType: sourceType === "youtube" ? "video/mp4" : "text/html",
    },
  ];

  let result: AiRecipe;
  try {
    const { object } = await generateObject({
      model: GEMINI_RECIPE_MODEL,
      schema: aiRecipeSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });
    result = object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 쿼터/레이트리밋 감지
    if (/429|rate.?limit|quota/i.test(msg)) {
      throw Object.assign(new Error("쿼터 초과"), { code: 429 });
    }
    throw err;
  }

  // 부분 추출 판단
  const missingFields: string[] = [];
  if (result.ingredients.length === 0) missingFields.push("ingredients");
  if (result.steps.length === 0) missingFields.push("steps");
  if (!result.title.trim()) missingFields.push("title");

  const partial = missingFields.includes("ingredients") || missingFields.includes("steps");

  // 신뢰도: 핵심 필드 채움 비율
  const filledCount = [
    result.title.trim() !== "",
    result.description.trim() !== "",
    result.servings > 1,
    result.cookTime !== null,
    result.ingredients.length > 0,
    result.steps.length > 0,
  ].filter(Boolean).length;
  const confidence = filledCount / 6;

  // 모든 핵심 필드가 빈약하면 422
  const allEmpty =
    !result.title.trim() &&
    result.ingredients.length === 0 &&
    result.steps.length === 0;
  if (allEmpty) {
    throw Object.assign(new Error("레시피 콘텐츠 부족"), { code: 422 });
  }

  return {
    recipe: result,
    sourceType,
    confidence,
    partial,
    missingFields,
  };
}
