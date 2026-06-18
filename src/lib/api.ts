import { NextResponse } from "next/server";

/**
 * Normalizes thrown errors (most importantly DB connectivity failures) into a
 * JSON response. Without this, an unhandled throw returns an empty body and the
 * client's `res.json()` blows up with "Unexpected end of JSON input".
 */
export function handleApiError(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api] ${context}:`, message);

  // Postgres / driver connectivity problems → 503 so callers can show a
  // "temporarily unavailable" state instead of a generic crash. Covers raw pg
  // socket errors, Supabase pooler messages, and Prisma's wrapped phrasings /
  // init error codes (P1001 unreachable, P1002 timeout, P1008/P1017 dropped).
  const code = (error as { code?: string })?.code;
  const isConnectivity =
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Tenant or user not found|terminating connection|Connection terminated|too many connections|Can't reach database server|the database server|Timed out fetching a new connection/i.test(
      message
    ) || ["P1001", "P1002", "P1008", "P1017"].includes(code ?? "");

  if (isConnectivity) {
    return NextResponse.json(
      { error: "데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: "요청을 처리하지 못했습니다." },
    { status: 500 }
  );
}
