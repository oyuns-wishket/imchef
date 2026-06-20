import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod/v4";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { extractRecipeFromUrl, classifyUrl } from "@/lib/ai/recipe";

const requestSchema = z.object({
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  // 1) 인증 확인
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 2) 요청 본문 파싱 + URL 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "올바른 링크를 입력해주세요." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "올바른 링크를 입력해주세요." },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // 3) 스킴 확인 (http/https만 허용)
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) {
      return NextResponse.json(
        {
          error:
            "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요.",
        },
        { status: 415 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "올바른 링크를 입력해주세요." },
      { status: 400 }
    );
  }

  // 4) URL 유형 사전 확인
  const sourceType = classifyUrl(url);
  if (!sourceType) {
    return NextResponse.json(
      {
        error:
          "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요.",
      },
      { status: 415 }
    );
  }

  // 5) AI 추출
  try {
    const result = await extractRecipeFromUrl(url);

    return NextResponse.json({
      recipe: {
        ...result.recipe,
        referenceUrl: url,
      },
      meta: {
        sourceType: result.sourceType,
        confidence: result.confidence,
        partial: result.partial,
        missingFields: result.missingFields,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: number }).code;

    console.error("[api/ai/recipe-from-url]", msg);

    if (code === 415) {
      return NextResponse.json(
        {
          error:
            "이 링크 유형은 아직 지원하지 않아요. 다른 링크를 사용해주세요.",
        },
        { status: 415 }
      );
    }
    if (code === 422) {
      return NextResponse.json(
        {
          error:
            "이 링크에서 레시피를 찾지 못했어요. 직접 입력해주세요.",
        },
        { status: 422 }
      );
    }
    if (code === 429 || /429|rate.?limit|quota/i.test(msg)) {
      return NextResponse.json(
        { error: "요청이 많아요. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }
    if (/AI_GATEWAY_API_KEY/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "지금은 AI 자동생성을 사용할 수 없어요. 직접 입력해주세요.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          "AI 분석에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.",
      },
      { status: 500 }
    );
  }
}
