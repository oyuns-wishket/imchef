import { describe, it, expect } from "vitest";
import {
  AiError,
  classifyAiError,
  resolveAiErrorKind,
  AI_ERROR_STATUS,
  type AiErrorMessages,
} from "./errors";

const messages: AiErrorMessages = {
  credentials: "키부재",
  unsupported: "미지원",
  noContent: "콘텐츠부족",
  safety: "세이프티",
  rateLimit: "쿼터",
  generic: "일반오류",
};

describe("resolveAiErrorKind", () => {
  it("AiError의 kind를 신뢰한다", () => {
    expect(resolveAiErrorKind(new AiError("noContent"))).toBe("noContent");
    expect(resolveAiErrorKind(new AiError("unsupported"))).toBe("unsupported");
  });

  it("세이프티 차단 메시지를 safety로 분류", () => {
    expect(resolveAiErrorKind(new Error("Request blocked by safety filter"))).toBe("safety");
    expect(resolveAiErrorKind(new Error("content_filter triggered"))).toBe("safety");
  });

  it("쿼터/레이트리밋 메시지를 rateLimit로 분류", () => {
    expect(resolveAiErrorKind(new Error("HTTP 429 Too Many Requests"))).toBe("rateLimit");
    expect(resolveAiErrorKind(new Error("quota exceeded"))).toBe("rateLimit");
    expect(resolveAiErrorKind(new Error("RESOURCE_EXHAUSTED"))).toBe("rateLimit");
  });

  it("자격증명 메시지를 credentials로 분류", () => {
    expect(resolveAiErrorKind(new Error("AI_GATEWAY_API_KEY missing"))).toBe("credentials");
    expect(resolveAiErrorKind(new Error("invalid api key"))).toBe("credentials");
  });

  it("그 외는 generic", () => {
    expect(resolveAiErrorKind(new Error("unexpected parse failure"))).toBe("generic");
    expect(resolveAiErrorKind("string error")).toBe("generic");
  });
});

describe("classifyAiError", () => {
  it("kind별 status와 도메인 메시지를 매핑", () => {
    expect(classifyAiError(new AiError("noContent"), messages)).toEqual({
      status: 422,
      error: "콘텐츠부족",
    });
    expect(classifyAiError(new AiError("unsupported"), messages)).toEqual({
      status: 415,
      error: "미지원",
    });
    expect(classifyAiError(new Error("429 rate limit"), messages)).toEqual({
      status: 429,
      error: "쿼터",
    });
    expect(classifyAiError(new Error("blocked by policy"), messages)).toEqual({
      status: 403,
      error: "세이프티",
    });
    expect(classifyAiError(new Error("AI_GATEWAY_API_KEY absent"), messages)).toEqual({
      status: 500,
      error: "키부재",
    });
    expect(classifyAiError(new Error("boom"), messages)).toEqual({
      status: 500,
      error: "일반오류",
    });
  });

  it("status 테이블이 모든 kind를 커버", () => {
    const kinds = Object.keys(messages) as (keyof AiErrorMessages)[];
    for (const k of kinds) {
      expect(AI_ERROR_STATUS[k]).toBeTypeOf("number");
    }
  });
});
