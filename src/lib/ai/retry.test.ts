import { describe, it, expect, vi } from "vitest";
import { withRetry, defaultIsRetryable } from "./retry";
import { AiError } from "./errors";

const noSleep = () => Promise.resolve();

describe("defaultIsRetryable", () => {
  it("rateLimit AiError는 재시도 가능", () => {
    expect(defaultIsRetryable(new AiError("rateLimit"))).toBe(true);
  });

  it("결정적 AiError(noContent/unsupported/safety/credentials)는 재시도 불가", () => {
    expect(defaultIsRetryable(new AiError("noContent"))).toBe(false);
    expect(defaultIsRetryable(new AiError("unsupported"))).toBe(false);
    expect(defaultIsRetryable(new AiError("safety"))).toBe(false);
    expect(defaultIsRetryable(new AiError("credentials"))).toBe(false);
  });

  it("네트워크/5xx/429 메시지는 재시도 가능", () => {
    expect(defaultIsRetryable(new Error("ETIMEDOUT"))).toBe(true);
    expect(defaultIsRetryable(new Error("503 Service Unavailable"))).toBe(true);
    expect(defaultIsRetryable(new Error("fetch failed"))).toBe(true);
    expect(defaultIsRetryable(new Error("429"))).toBe(true);
  });

  it("일반 오류는 재시도 불가", () => {
    expect(defaultIsRetryable(new Error("invalid schema"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("첫 시도 성공 시 재시도 없이 반환", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("재시도 가능 오류는 retries+1회까지 시도 후 성공", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AiError("rateLimit"))
      .mockRejectedValueOnce(new AiError("rateLimit"))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn, { retries: 2, sleep: noSleep });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("재시도 불가 오류는 즉시 전파(1회만 시도)", async () => {
    const fn = vi.fn().mockRejectedValue(new AiError("noContent"));
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toBeInstanceOf(AiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("재시도 소진 후 마지막 오류 전파", async () => {
    const fn = vi.fn().mockRejectedValue(new AiError("rateLimit"));
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toBeInstanceOf(AiError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("지수 백오프 지연을 sleep에 전달", async () => {
    const delays: number[] = [];
    const sleep = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi.fn().mockRejectedValue(new AiError("rateLimit"));
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 100, sleep })
    ).rejects.toBeTruthy();
    expect(delays).toEqual([100, 200]);
  });
});
