/**
 * SSRF 안전 fetcher: 리다이렉트를 수동 추적하며 매 hop마다 호스트를 재검증한다.
 *
 * Node fetch 기본값(redirect:"follow")은 공인→사설 리다이렉트로 가드를 우회시킨다.
 * 여기서는 redirect:"manual"로 받아 3xx Location을 직접 따라가되, 각 목적지에
 * assertPublicHttpUrl을 다시 적용한다. 순수 판정(상태/Location 해석)은 분리 테스트하고,
 * 실제 네트워크(rawFetch)는 주입한다.
 */
import { AiError } from "../errors";
import { assertPublicHttpUrl } from "./url-guard";
import type { FetchLike } from "./youtube";

export interface RawResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type RawFetch = (
  url: string,
  init: { headers?: Record<string, string>; redirect: "manual" }
) => Promise<RawResponse>;

export function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304;
}

function adapt(res: RawResponse) {
  return {
    ok: res.ok,
    status: res.status,
    text: () => res.text(),
    contentType: res.headers.get("content-type") ?? undefined,
  };
}

/** 상대/절대 Location을 현재 URL 기준 절대 URL로 해석. */
export function resolveRedirect(currentUrl: string, location: string): string {
  return new URL(location, currentUrl).toString();
}

/** 가드된 FetchLike 생성. 매 hop assertPublicHttpUrl 재검증, maxRedirects 초과 시 차단. */
export function createGuardedFetcher(
  rawFetch: RawFetch,
  maxRedirects = 3
): FetchLike {
  return async (url, init) => {
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      assertPublicHttpUrl(current); // 초기 + 모든 리다이렉트 목적지 재검증
      const res = await rawFetch(current, { headers: init?.headers, redirect: "manual" });

      if (isRedirectStatus(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          return adapt(res);
        }
        current = resolveRedirect(current, location);
        continue;
      }
      return adapt(res);
    }
    throw new AiError("unsupported", "리다이렉트가 너무 많습니다");
  };
}
