import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { classifyAiError, type AiErrorMessages } from "@/lib/ai/errors";
import { classifyUrl, type ExtractRecipeResult } from "@/lib/ai/recipe";

const requestSchema = z.object({ url: z.string().url() });

const MESSAGES: AiErrorMessages = {
  credentials: "지금은 AI 자동생성을 사용할 수 없어요. 직접 입력해주세요.",
  unsupported: "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요.",
  noContent: "이 링크에서 레시피를 찾지 못했어요. 직접 입력해주세요.",
  safety: "이 링크는 분석할 수 없어요. 다른 링크를 사용해주세요.",
  rateLimit: "요청이 많아요. 잠시 후 다시 시도해주세요.",
  generic: "AI 분석에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.",
};

export interface RecipeRouteDeps {
  getUserId: () => Promise<string | null>;
  extract: (url: string) => Promise<ExtractRecipeResult>;
}

/**
 * URL→레시피 추출 라우트 핸들러(주입형). next/headers·iron-session 비의존이라
 * cookies 모킹 없이 통합 테스트가 가능하다.
 */
export async function handleRecipeFromUrl(
  req: Request,
  deps: RecipeRouteDeps
): Promise<Response> {
  // 1) 인증
  const userId = await deps.getUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 2) 본문 파싱 + URL 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "올바른 링크를 입력해주세요." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "올바른 링크를 입력해주세요." }, { status: 400 });
  }
  const { url } = parsed.data;

  // 3) URL 유형 사전 확인(스킴 http/https + youtube/web 판별)
  if (!classifyUrl(url)) {
    return NextResponse.json({ error: MESSAGES.unsupported }, { status: 415 });
  }

  // 4) 추출
  try {
    const result = await deps.extract(url);
    return NextResponse.json({
      recipe: { ...result.recipe, referenceUrl: url },
      meta: {
        sourceType: result.sourceType,
        confidence: result.confidence,
        partial: result.partial,
        missingFields: result.missingFields,
      },
    });
  } catch (err) {
    const { status, error } = classifyAiError(err, MESSAGES);
    console.error(
      "[api/ai/recipe-from-url]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error }, { status });
  }
}
