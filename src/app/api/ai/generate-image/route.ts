import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { generateRecipeImages } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  // 1. 로그인 확인
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 2. body 파싱 및 검증
  let body: { prompt?: string; n?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "올바른 프롬프트를 입력해주세요." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 500) {
    return NextResponse.json({ error: "올바른 프롬프트를 입력해주세요." }, { status: 400 });
  }

  const rawN = body.n ?? 2;
  const n = Math.min(Math.max(1, Math.floor(rawN)), 4);

  // 3. AI 이미지 생성 및 Storage 저장
  try {
    const images = await generateRecipeImages(prompt, n);

    if (images.length === 0) {
      return NextResponse.json(
        { error: "AI 이미지 생성을 처리할 수 없어요. 잠시 후 다시 시도하거나 직접 업로드해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/ai/generate-image]", message);

    // 에러 타입 분류
    if (message.includes("AI_GATEWAY_API_KEY")) {
      return NextResponse.json(
        { error: "AI 이미지 생성을 처리할 수 없어요. 잠시 후 다시 시도하거나 직접 업로드해주세요." },
        { status: 500 }
      );
    }

    // 세이프티 차단 감지 (Google API 응답 패턴)
    if (
      message.toLowerCase().includes("safety") ||
      message.toLowerCase().includes("blocked") ||
      message.toLowerCase().includes("content_filter") ||
      message.toLowerCase().includes("policy")
    ) {
      return NextResponse.json(
        { error: "해당 내용으로는 이미지를 만들 수 없어요. 다른 묘사로 시도해주세요." },
        { status: 403 }
      );
    }

    // 쿼터/레이트리밋 감지
    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("rate")
    ) {
      return NextResponse.json(
        { error: "요청이 많아요. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "AI 이미지 생성을 처리할 수 없어요. 잠시 후 다시 시도하거나 직접 업로드해주세요." },
      { status: 500 }
    );
  }
}
