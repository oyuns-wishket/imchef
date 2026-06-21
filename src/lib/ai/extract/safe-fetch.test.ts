import { describe, it, expect, vi } from "vitest";
import {
  isRedirectStatus,
  resolveRedirect,
  createGuardedFetcher,
  type RawFetch,
  type RawResponse,
} from "./safe-fetch";
import { AiError } from "../errors";

describe("isRedirectStatus", () => {
  it("3xx(304 제외)만 리다이렉트", () => {
    expect(isRedirectStatus(301)).toBe(true);
    expect(isRedirectStatus(302)).toBe(true);
    expect(isRedirectStatus(307)).toBe(true);
    expect(isRedirectStatus(304)).toBe(false);
    expect(isRedirectStatus(200)).toBe(false);
    expect(isRedirectStatus(404)).toBe(false);
  });
});

describe("resolveRedirect", () => {
  it("상대/절대 Location 해석", () => {
    expect(resolveRedirect("https://a.com/x/y", "/z")).toBe("https://a.com/z");
    expect(resolveRedirect("https://a.com/x", "https://b.com/q")).toBe("https://b.com/q");
  });
});

const mkRes = (status: number, location?: string, body = ""): RawResponse => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (n: string) => (n.toLowerCase() === "location" ? location ?? null : null) },
  text: () => Promise.resolve(body),
});

describe("createGuardedFetcher", () => {
  it("리다이렉트 없이 정상 응답 통과", async () => {
    const raw: RawFetch = vi.fn(async () => mkRes(200, undefined, "ok"));
    const fetcher = createGuardedFetcher(raw);
    const res = await fetcher("https://blog.naver.com/x");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("공인→공인 리다이렉트는 따라간다", async () => {
    const raw: RawFetch = vi
      .fn()
      .mockResolvedValueOnce(mkRes(302, "https://final.com/page"))
      .mockResolvedValueOnce(mkRes(200, undefined, "done"));
    const fetcher = createGuardedFetcher(raw);
    const res = await fetcher("https://start.com/x");
    expect(res.status).toBe(200);
    expect(raw).toHaveBeenCalledTimes(2);
  });

  it("공인→사설 IP 리다이렉트는 차단(SSRF)", async () => {
    const raw: RawFetch = vi
      .fn()
      .mockResolvedValueOnce(mkRes(302, "http://169.254.169.254/latest/meta-data/"));
    const fetcher = createGuardedFetcher(raw);
    await expect(fetcher("https://evil.com/x")).rejects.toBeInstanceOf(AiError);
  });

  it("최초 URL이 사설이면 즉시 차단", async () => {
    const raw: RawFetch = vi.fn();
    const fetcher = createGuardedFetcher(raw);
    await expect(fetcher("http://127.0.0.1/x")).rejects.toBeInstanceOf(AiError);
    expect(raw).not.toHaveBeenCalled();
  });

  it("리다이렉트 한도 초과 차단", async () => {
    const raw: RawFetch = vi.fn(async (url: string) =>
      mkRes(302, "https://pub" + url.length + ".com/next")
    );
    const fetcher = createGuardedFetcher(raw, 2);
    await expect(fetcher("https://start.com/x")).rejects.toBeInstanceOf(AiError);
  });
});
