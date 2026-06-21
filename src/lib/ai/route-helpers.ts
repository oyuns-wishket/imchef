import "server-only";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { classifyAiError, type AiErrorMessages } from "./errors";

/** iron-session에서 로그인 사용자 id를 얻는다. 미인증이면 null. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session.userId ?? null;
}

/** 미인증 401 표준 응답. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

/**
 * AI 라우트 공통 에러 응답. AiError/메시지 패턴을 status+사용자 메시지로 변환하고
 * 원인은 서버 로그로만 남긴다(키/내부 메시지 비노출).
 */
export function aiErrorResponse(
  error: unknown,
  context: string,
  messages: AiErrorMessages
): NextResponse {
  const { status, error: userMessage } = classifyAiError(error, messages);
  console.error(`[ai] ${context}:`, error instanceof Error ? error.message : String(error));
  return NextResponse.json({ error: userMessage }, { status });
}
