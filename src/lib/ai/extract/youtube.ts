/**
 * YouTube 자막(transcript) 추출.
 *
 * 이슈 #8: file part로 영상 URL을 직접 넘기면 Gateway 경유 시 영상이 실제로
 * 인제스트되지 않아(입력토큰 ~53) 재료·순서가 빈다. 자막을 텍스트로 먼저 뽑아
 * generateObject에 투입하면 결정적이고 정확하다.
 *
 * 네트워크 의존 부분(fetch)은 주입 가능하게 분리하고, 파싱은 모두 순수 함수다.
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

/** XML/HTML 엔티티를 디코드한다(자막 텍스트 정리용). */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    );
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string; // "asr" = 자동생성
}

/** watch 페이지 HTML에서 ytInitialPlayerResponse JSON 객체를 추출한다. */
export function extractPlayerResponse(html: string): unknown | null {
  // 실제 할당(`ytInitialPlayerResponse = {`)만 매칭 — 주석/문자열 내 단순 언급 회피.
  const assign = html.match(/ytInitialPlayerResponse\s*=\s*\{/);
  if (!assign || assign.index === undefined) return null;
  const braceStart = assign.index + assign[0].length - 1;

  // 중괄호 균형으로 JSON 끝을 찾는다(문자열/이스케이프 인지).
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const json = html.slice(braceStart, i + 1);
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** playerResponse에서 자막 트랙 목록을 얻는다. */
export function getCaptionTracks(playerResponse: unknown): CaptionTrack[] {
  const tracks = (playerResponse as Record<string, unknown> | null)?.captions as
    | Record<string, unknown>
    | undefined;
  const renderer = tracks?.playerCaptionsTracklistRenderer as
    | Record<string, unknown>
    | undefined;
  const list = renderer?.captionTracks;
  if (!Array.isArray(list)) return [];
  return list
    .filter((t): t is CaptionTrack => typeof t?.baseUrl === "string")
    .map((t) => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode,
      kind: t.kind,
    }));
}

/** 언어 선호(기본 한국어 우선, 수동자막 > 자동생성)로 트랙 1개를 고른다. */
export function selectCaptionTrack(
  tracks: CaptionTrack[],
  langPrefs: string[] = ["ko", "en"]
): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const score = (t: CaptionTrack): number => {
    const langIdx = langPrefs.findIndex((l) => t.languageCode?.startsWith(l));
    const langScore = langIdx === -1 ? langPrefs.length : langIdx;
    const asrPenalty = t.kind === "asr" ? 0.5 : 0; // 자동생성(asr)은 후순위
    return langScore + asrPenalty;
  };
  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}

/** timedtext XML(<transcript><text>...)을 평문으로 변환한다. */
export function parseTimedTextXml(xml: string): string {
  const matches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];
  return matches
    .map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** timedtext json3(events[].segs[].utf8)을 평문으로 변환한다. */
export function parseTimedTextJson3(body: string): string {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return "";
  }
  const events = (data as { events?: unknown }).events;
  if (!Array.isArray(events)) return "";
  return events
    .flatMap((e: unknown) => {
      const segs = (e as { segs?: unknown }).segs;
      return Array.isArray(segs)
        ? segs.map((s: unknown) => (s as { utf8?: string }).utf8 ?? "")
        : [];
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** baseUrl에 fmt를 강제(기존 fmt 치환). */
export function withCaptionFormat(baseUrl: string, fmt: string): string {
  if (/[?&]fmt=/.test(baseUrl)) return baseUrl.replace(/([?&]fmt=)[^&]*/, `$1${fmt}`);
  return baseUrl + (baseUrl.includes("?") ? "&" : "?") + `fmt=${fmt}`;
}

const WATCH_HEADERS = {
  // 일관된 HTML(자막 트랙 포함)을 받기 위한 데스크톱 UA + 한국어 우선.
  // CONSENT 쿠키로 EU/신규세션 consent 인터스티셜을 우회(playerResponse 부재 회피).
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "ko,en;q=0.8",
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

export interface YoutubeTranscriptOptions {
  fetcher: FetchLike;
  langPrefs?: string[];
}

/**
 * videoId → 자막 평문. 자막이 없거나 접근 불가(consent/봇차단/지역잠금 포함)면
 * 빈 문자열을 반환한다. 호출측은 빈 결과를 "추출 실패"로 정직하게 처리한다
 * (영상 직접전달 폴백은 SDK 계약상 동작하지 않아 폐기됨).
 */
export async function fetchYoutubeTranscript(
  videoId: string,
  { fetcher, langPrefs = ["ko", "en"] }: YoutubeTranscriptOptions
): Promise<string> {
  const watchRes = await fetcher(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: WATCH_HEADERS,
  });
  if (!watchRes.ok) return "";

  const html = await watchRes.text();
  const playerResponse = extractPlayerResponse(html);
  if (!playerResponse) return "";

  const track = selectCaptionTrack(getCaptionTracks(playerResponse), langPrefs);
  if (!track) return "";

  // 1차: json3(안정적 구조).
  const json3Res = await fetcher(withCaptionFormat(track.baseUrl, "json3"), {
    headers: WATCH_HEADERS,
  });
  if (json3Res.ok) {
    const text = parseTimedTextJson3(await json3Res.text());
    if (text) return text;
  }

  // 2차: srv3(XML)로 실제 재요청(서버가 json3를 무시했거나 빈 경우 대비).
  const xmlRes = await fetcher(withCaptionFormat(track.baseUrl, "srv3"), {
    headers: WATCH_HEADERS,
  });
  if (!xmlRes.ok) return "";
  return parseTimedTextXml(await xmlRes.text());
}
