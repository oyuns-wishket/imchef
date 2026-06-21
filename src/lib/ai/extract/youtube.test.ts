import { describe, it, expect } from "vitest";
import { parseYoutubeVideoId } from "./youtube";

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
