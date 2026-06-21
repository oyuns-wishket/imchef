import { describe, it, expect } from "vitest";
import { hasAiCredentials, assertAiCredentials, type AiCredentialEnv } from "./auth";
import { AiError } from "./errors";

describe("AI credentials (OIDC 우선 + 키 fallback)", () => {
  it("AI_GATEWAY_API_KEY가 있으면 통과", () => {
    const env: AiCredentialEnv = { AI_GATEWAY_API_KEY: "sk-test" };
    expect(hasAiCredentials(env)).toBe(true);
    expect(() => assertAiCredentials(env)).not.toThrow();
  });

  it("VERCEL_OIDC_TOKEN만 있어도 통과(키 없이 OIDC)", () => {
    const env: AiCredentialEnv = { VERCEL_OIDC_TOKEN: "oidc-token" };
    expect(hasAiCredentials(env)).toBe(true);
    expect(() => assertAiCredentials(env)).not.toThrow();
  });

  it("둘 다 없으면 credentials AiError", () => {
    const env: AiCredentialEnv = {};
    expect(hasAiCredentials(env)).toBe(false);
    try {
      assertAiCredentials(env);
      expect.unreachable("던졌어야 함");
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe("credentials");
    }
  });

  it("공백 문자열은 자격증명으로 보지 않는다", () => {
    const env: AiCredentialEnv = { AI_GATEWAY_API_KEY: "   ", VERCEL_OIDC_TOKEN: "" };
    expect(hasAiCredentials(env)).toBe(false);
  });
});
