/**
 * AI 파이프라인 공통 에러 모델.
 *
 * 두 라우트(recipe-from-url, generate-image)가 중복 구현하던 415/422/429/403/500
 * 분기를 단일 `kind` 분류로 통합한다. 순수 모듈(next/server·env 비의존)이라
 * 키 없이 단위 테스트가 가능하다. HTTP 응답 생성은 라우트가 담당한다.
 */

export type AiErrorKind =
  | "credentials" // AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN 모두 부재 → 500
  | "unsupported" // 미지원 입력(URL 유형 등) → 415
  | "noContent" // 분석은 됐으나 추출할 콘텐츠 부족 → 422
  | "safety" // 모델 세이프티/콘텐츠 정책 차단 → 403
  | "rateLimit" // 게이트웨이 쿼터/레이트리밋 → 429
  | "generic"; // 그 외 호출/파싱 실패 → 500

export const AI_ERROR_STATUS: Record<AiErrorKind, number> = {
  credentials: 500,
  unsupported: 415,
  noContent: 422,
  safety: 403,
  rateLimit: 429,
  generic: 500,
};

/** 도메인별 사용자 노출 메시지(라우트가 주입). */
export type AiErrorMessages = Record<AiErrorKind, string>;

export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message?: string, options?: { cause?: unknown }) {
    super(message ?? kind, options);
    this.name = "AiError";
    this.kind = kind;
  }
}

/**
 * 임의의 throw 값을 AiErrorKind로 분류한다.
 * AiError면 그 kind를 신뢰하고, 아니면 메시지 패턴으로 추정한다.
 */
export function resolveAiErrorKind(error: unknown): AiErrorKind {
  if (error instanceof AiError) return error.kind;

  const message = error instanceof Error ? error.message : String(error);

  if (/safety|blocked|content[_ ]?filter|policy|prohibited/i.test(message)) {
    return "safety";
  }
  if (/\b429\b|rate.?limit|quota|resource[_ ]?exhausted/i.test(message)) {
    return "rateLimit";
  }
  if (/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|credential|unauthor|api key/i.test(message)) {
    return "credentials";
  }
  return "generic";
}

/** 에러 → { status, error(사용자 메시지) }. 라우트의 NextResponse.json에 그대로 사용. */
export function classifyAiError(
  error: unknown,
  messages: AiErrorMessages
): { status: number; error: string } {
  const kind = resolveAiErrorKind(error);
  return { status: AI_ERROR_STATUS[kind], error: messages[kind] ?? messages.generic };
}
