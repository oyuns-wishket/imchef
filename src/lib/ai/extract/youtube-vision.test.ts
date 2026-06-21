import { describe, it, expect, vi } from "vitest";
import {
  toWatchUrl,
  looksUningested,
  extractRecipeTextFromVideo,
  VISION_PROMPT,
  type VisionGenerate,
} from "./youtube-vision";

describe("toWatchUrl", () => {
  it("shorts/youtu.be/watch를 watch 형식으로 정규화", () => {
    expect(toWatchUrl("https://www.youtube.com/shorts/7GOnZ0-PW6w")).toBe(
      "https://www.youtube.com/watch?v=7GOnZ0-PW6w"
    );
    expect(toWatchUrl("https://youtu.be/7GOnZ0-PW6w")).toBe(
      "https://www.youtube.com/watch?v=7GOnZ0-PW6w"
    );
    expect(toWatchUrl("https://m.youtube.com/watch?v=7GOnZ0-PW6w&t=10s")).toBe(
      "https://www.youtube.com/watch?v=7GOnZ0-PW6w"
    );
  });
  it("유튜브 아니면 null", () => {
    expect(toWatchUrl("https://naver.com/x")).toBeNull();
  });
});

describe("looksUningested", () => {
  it("시청 불가 신호 감지", () => {
    expect(looksUningested("이 영상은 직접 시청할 수 없어 정확한 내용을 파악하기 어렵습니다")).toBe(true);
    expect(looksUningested("영상을 볼 수 없습니다")).toBe(true);
    expect(looksUningested("동영상을 재생할 수 없음")).toBe(true);
  });
  it("정상 추출 텍스트는 false", () => {
    expect(looksUningested("재료: 돼지고기 120g, 김치 150g. 조리: 볶고 끓인다")).toBe(false);
  });
});

describe("extractRecipeTextFromVideo", () => {
  it("정상 인제스트: watch URL로 generate 호출, ingested=true", async () => {
    const generate = vi.fn<VisionGenerate>(async () => ({
      text: "제목: 김치찌개\n재료: 돼지고기 120g, 김치 150g\n순서: 볶고 끓인다",
      inputTokens: 12703,
    }));
    const r = await extractRecipeTextFromVideo("https://www.youtube.com/shorts/7GOnZ0-PW6w", {
      generate,
      model: "gemini-2.5-flash",
    });
    expect(r.ingested).toBe(true);
    expect(r.text).toContain("돼지고기");
    // shorts → watch 정규화 + prompt 전달 확인
    expect(generate.mock.calls[0][0].videoUrl).toBe("https://www.youtube.com/watch?v=7GOnZ0-PW6w");
    expect(generate.mock.calls[0][0].prompt).toBe(VISION_PROMPT);
    expect(generate.mock.calls[0][0].model).toBe("gemini-2.5-flash");
  });

  it("시청 불가 응답: ingested=false", async () => {
    const generate = vi.fn<VisionGenerate>(async () => ({
      text: "이 영상은 직접 시청할 수 없어 일반적인 레시피를 정리합니다",
      inputTokens: 700000,
    }));
    const r = await extractRecipeTextFromVideo("https://youtu.be/7GOnZ0-PW6w", {
      generate,
      model: "gemini-2.5-flash",
    });
    expect(r.ingested).toBe(false);
  });

  it("너무 짧은 응답: ingested=false", async () => {
    const generate = vi.fn<VisionGenerate>(async () => ({ text: "음.", inputTokens: 100 }));
    const r = await extractRecipeTextFromVideo("https://youtu.be/7GOnZ0-PW6w", {
      generate,
      model: "gemini-2.5-flash",
    });
    expect(r.ingested).toBe(false);
  });

  it("유튜브 아닌 URL은 빈 결과(ingested=false), generate 미호출", async () => {
    const generate = vi.fn<VisionGenerate>();
    const r = await extractRecipeTextFromVideo("https://naver.com/x", {
      generate,
      model: "gemini-2.5-flash",
    });
    expect(r.ingested).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });
});
