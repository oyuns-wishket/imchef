import { NextResponse } from "next/server";
import { classifyAiError, type AiErrorMessages } from "@/lib/ai/errors";
import type { GeneratedImageResult } from "@/lib/ai/gemini";

const UNAVAILABLE =
  "AI 이미지 생성을 처리할 수 없어요. 잠시 후 다시 시도하거나 직접 업로드해주세요.";

const MESSAGES: AiErrorMessages = {
  credentials: UNAVAILABLE,
  unsupported: UNAVAILABLE,
  noContent: UNAVAILABLE,
  safety: "해당 내용으로는 이미지를 만들 수 없어요. 다른 묘사로 시도해주세요.",
  rateLimit: "요청이 많아요. 잠시 후 다시 시도해주세요.",
  generic: UNAVAILABLE,
};

export interface ImageRouteDeps {
  getUserId: () => Promise<string | null>;
  generate: (prompt: string, n: number) => Promise<GeneratedImageResult[]>;
}

/**
 * AI 이미지 생성 라우트 핸들러(주입형). cookies/iron-session 비의존이라
 * 통합 테스트가 가능하다.
 */
export async function handleGenerateImage(
  req: Request,
  deps: ImageRouteDeps
): Promise<Response> {
  // 1) 인증
  const userId = await deps.getUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 2) 본문 검증
  let body: { prompt?: unknown; n?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "올바른 프롬프트를 입력해주세요." }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 500) {
    return NextResponse.json({ error: "올바른 프롬프트를 입력해주세요." }, { status: 400 });
  }
  const rawN = typeof body.n === "number" ? body.n : 2;
  const n = Math.min(Math.max(1, Math.floor(rawN)), 4);

  // 3) 생성
  try {
    const images = await deps.generate(prompt, n);
    if (images.length === 0) {
      return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
    }
    return NextResponse.json({ images });
  } catch (err) {
    const { status, error } = classifyAiError(err, MESSAGES);
    console.error(
      "[api/ai/generate-image]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error }, { status });
  }
}
