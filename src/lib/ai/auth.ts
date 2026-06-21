import { AiError } from "./errors";

/** 자격증명 판정에 필요한 환경변수 부분집합(process.env 할당 호환). */
export type AiCredentialEnv = {
  AI_GATEWAY_API_KEY?: string;
  VERCEL_OIDC_TOKEN?: string;
  [key: string]: string | undefined;
};

/**
 * AI 게이트웨이 자격증명 확인.
 *
 * Vercel 배포 환경은 OIDC(VERCEL_OIDC_TOKEN)로 자동 인증되므로
 * AI_GATEWAY_API_KEY가 없어도 동작해야 한다(이슈 #8 §4). 둘 다 없을 때만
 * credentials 에러를 던진다. env를 주입받아 테스트 가능.
 */
export function hasAiCredentials(env: AiCredentialEnv = process.env): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim());
}

export function assertAiCredentials(env: AiCredentialEnv = process.env): void {
  if (!hasAiCredentials(env)) {
    throw new AiError(
      "credentials",
      "AI credentials missing: set AI_GATEWAY_API_KEY or run on Vercel with OIDC enabled."
    );
  }
}
