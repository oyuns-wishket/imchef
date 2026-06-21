import { AiError } from "./errors";

/**
 * 지수 백오프 재시도. 일시적 오류(레이트리밋/네트워크/5xx)만 재시도하고
 * 결정적 오류(미지원/콘텐츠부족/세이프티/자격증명)는 즉시 전파한다.
 * sleep을 주입받아 타이머 없이 단위 테스트한다.
 */

export interface RetryOptions {
  /** 최초 시도 외 추가 재시도 횟수. 기본 2 (총 3회 시도). */
  retries?: number;
  /** 1차 백오프 지연(ms). 기본 300. attempt마다 2배. */
  baseDelayMs?: number;
  /** 지연 함수(주입). 기본 setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** 재시도 가능 판정(주입). 기본 defaultIsRetryable. */
  isRetryable?: (error: unknown) => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof AiError) return error.kind === "rateLimit";
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|\b50[023]\b|rate.?limit|quota|resource[_ ]?exhausted|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network|temporarily|fetch failed/i.test(
    message
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 300,
    sleep = defaultSleep,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
