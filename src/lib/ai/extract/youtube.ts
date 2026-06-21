/**
 * YouTube URL 유틸. 자막 스크래핑은 폐기됐고(영상 직접 이해로 대체 — youtube-vision.ts),
 * videoId 파싱과 공유 FetchLike 타입만 유지한다.
 */

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  /** 응답 Content-Type(가드 fetcher가 채움). 없으면 검증 skip. */
  contentType?: string;
}>;

/** 다양한 YouTube URL 형태에서 11자리 videoId를 파싱한다. */
export function parseYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && idPattern.test(id) ? id : null;
  }

  const isYoutubeHost =
    host === "youtube.com" || host === "m.youtube.com" || host.endsWith(".youtube.com");
  if (!isYoutubeHost) return null;

  // watch?v=<id>
  const vParam = url.searchParams.get("v");
  if (vParam && idPattern.test(vParam)) return vParam;

  // /shorts/<id>, /live/<id>, /embed/<id>, /v/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  const known = new Set(["shorts", "live", "embed", "v"]);
  if (segments.length >= 2 && known.has(segments[0])) {
    const id = segments[1];
    if (idPattern.test(id)) return id;
  }

  return null;
}
