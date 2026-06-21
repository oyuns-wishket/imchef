import { describe, it, expect, vi } from "vitest";
import {
  parseYoutubeVideoId,
  decodeHtmlEntities,
  extractPlayerResponse,
  getCaptionTracks,
  selectCaptionTrack,
  parseTimedTextXml,
  parseTimedTextJson3,
  withCaptionFormat,
  fetchYoutubeTranscript,
  type FetchLike,
} from "./youtube";

describe("parseYoutubeVideoId", () => {
  it("watch?v=, shorts, youtu.be, live, embed 전부 파싱", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=PILBBlFEmLg")).toBe(
      "PILBBlFEmLg"
    );
    expect(parseYoutubeVideoId("https://www.youtube.com/shorts/PILBBlFEmLg")).toBe(
      "PILBBlFEmLg"
    );
    expect(parseYoutubeVideoId("https://youtu.be/PILBBlFEmLg")).toBe("PILBBlFEmLg");
    expect(parseYoutubeVideoId("https://m.youtube.com/watch?v=PILBBlFEmLg&t=10s")).toBe(
      "PILBBlFEmLg"
    );
    expect(parseYoutubeVideoId("https://www.youtube.com/live/PILBBlFEmLg")).toBe(
      "PILBBlFEmLg"
    );
    expect(parseYoutubeVideoId("https://www.youtube.com/embed/PILBBlFEmLg")).toBe(
      "PILBBlFEmLg"
    );
  });

  it("비-YouTube/형식오류는 null", () => {
    expect(parseYoutubeVideoId("https://naver.com/x")).toBeNull();
    expect(parseYoutubeVideoId("not-a-url")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("명명/숫자 엔티티 디코드", () => {
    expect(decodeHtmlEntities("a&amp;b &#39;c&#39; &quot;d&quot; &#xAC00;")).toBe(
      "a&b 'c' \"d\" 가"
    );
  });
});

describe("extractPlayerResponse / caption tracks", () => {
  const html = `<html><script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://t/ko","languageCode":"ko","kind":"asr"},{"baseUrl":"https://t/ko-manual","languageCode":"ko"},{"baseUrl":"https://t/en","languageCode":"en"}]}}};</script></html>`;

  it("HTML에서 playerResponse JSON을 균형 파싱", () => {
    const pr = extractPlayerResponse(html);
    expect(pr).not.toBeNull();
    const tracks = getCaptionTracks(pr);
    expect(tracks).toHaveLength(3);
  });

  it("자막 없으면 빈 배열", () => {
    expect(getCaptionTracks(extractPlayerResponse("<html>no pr</html>"))).toEqual([]);
  });

  it("한국어 수동자막을 자동생성(asr)보다 우선 선택", () => {
    const tracks = getCaptionTracks(extractPlayerResponse(html));
    const picked = selectCaptionTrack(tracks, ["ko", "en"]);
    expect(picked?.baseUrl).toBe("https://t/ko-manual");
  });

  it("선호 언어 없으면 fallback 순서", () => {
    const tracks = getCaptionTracks(extractPlayerResponse(html));
    const picked = selectCaptionTrack(tracks, ["ja"]);
    expect(picked).not.toBeNull();
  });
});

describe("parseTimedTextXml", () => {
  it("text 노드를 평문으로 결합 + 엔티티 디코드", () => {
    const xml = `<?xml version="1.0"?><transcript><text start="0" dur="2">제육볶음&#39;s</text><text start="2" dur="3">고추장 2큰술</text></transcript>`;
    expect(parseTimedTextXml(xml)).toBe("제육볶음's 고추장 2큰술");
  });
});

describe("parseTimedTextJson3", () => {
  it("events[].segs[].utf8을 평문으로 결합", () => {
    const json = JSON.stringify({
      events: [
        { segs: [{ utf8: "재료 " }, { utf8: "손질" }] },
        { segs: [{ utf8: " 볶기" }] },
        { otherKey: 1 },
      ],
    });
    expect(parseTimedTextJson3(json)).toBe("재료 손질 볶기");
  });
  it("깨진 json은 빈 문자열", () => {
    expect(parseTimedTextJson3("{broken")).toBe("");
    expect(parseTimedTextJson3("{}")).toBe("");
  });
});

describe("withCaptionFormat", () => {
  it("fmt 없으면 추가, 있으면 치환", () => {
    expect(withCaptionFormat("https://t/ko?lang=ko", "json3")).toBe(
      "https://t/ko?lang=ko&fmt=json3"
    );
    expect(withCaptionFormat("https://t/ko?fmt=srv3&lang=ko", "json3")).toBe(
      "https://t/ko?fmt=json3&lang=ko"
    );
  });
});

describe("extractPlayerResponse 견고성", () => {
  it("단순 언급(할당 아님)은 무시", () => {
    expect(
      extractPlayerResponse(`<p>ytInitialPlayerResponse 라는 변수가 있습니다 {여기는 본문}</p>`)
    ).toBeNull();
  });
});

describe("fetchYoutubeTranscript (주입 fetcher)", () => {
  const mkRes = (ok: boolean, body: string) => ({
    ok,
    status: ok ? 200 : 404,
    text: () => Promise.resolve(body),
  });

  const watchHtml = `<script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://timedtext/ko","languageCode":"ko"}]}}};</script>`;

  it("watch HTML → 트랙 → json3 자막 평문 추출(2 fetch)", async () => {
    const json3 = JSON.stringify({
      events: [{ segs: [{ utf8: "재료 손질" }] }, { segs: [{ utf8: " 볶기" }] }],
    });
    const fetcher: FetchLike = vi.fn((url: string) =>
      Promise.resolve(url.includes("timedtext") ? mkRes(true, json3) : mkRes(true, watchHtml))
    );
    const out = await fetchYoutubeTranscript("PILBBlFEmLg", { fetcher });
    expect(out).toBe("재료 손질 볶기");
    expect(fetcher).toHaveBeenCalledTimes(2); // watch + json3
  });

  it("json3 비면 srv3(XML)로 2차 fetch 폴백", async () => {
    const xml = `<transcript><text>썰기</text><text>끓이기</text></transcript>`;
    const fetcher: FetchLike = vi.fn((url: string) => {
      if (!url.includes("timedtext")) return Promise.resolve(mkRes(true, watchHtml));
      // json3 요청엔 빈 본문, srv3 요청엔 XML
      return Promise.resolve(mkRes(true, url.includes("fmt=json3") ? "{}" : xml));
    });
    const out = await fetchYoutubeTranscript("PILBBlFEmLg", { fetcher });
    expect(out).toBe("썰기 끓이기");
    expect(fetcher).toHaveBeenCalledTimes(3); // watch + json3 + srv3
  });

  it("자막 없으면 빈 문자열(폴백 신호)", async () => {
    const fetcher: FetchLike = vi.fn(() =>
      Promise.resolve(mkRes(true, "<html>no captions</html>"))
    );
    expect(await fetchYoutubeTranscript("PILBBlFEmLg", { fetcher })).toBe("");
  });

  it("watch 페이지 접근 실패 시 빈 문자열", async () => {
    const fetcher: FetchLike = vi.fn(() => Promise.resolve(mkRes(false, "")));
    expect(await fetchYoutubeTranscript("PILBBlFEmLg", { fetcher })).toBe("");
  });
});
