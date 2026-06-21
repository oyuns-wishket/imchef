import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyUrl,
  computeMissingFields,
  isPartial,
  computeConfidence,
  extractRecipeFromUrl,
  type AiRecipe,
  type ExtractDeps,
} from "./recipe";
import { AiError } from "./errors";
import type { FetchLike } from "./extract/youtube";

const fullRecipe: AiRecipe = {
  title: "제육볶음",
  description: "매콤한 제육볶음",
  servings: 2,
  cookTime: 30,
  difficulty: "normal",
  ingredients: [{ name: "돼지고기", amount: "300", unit: "g" }],
  steps: [{ content: "양념" }, { content: "볶기" }],
};

const emptyObject = {
  title: "",
  description: "",
  servings: 1,
  cookTime: null,
  difficulty: "normal" as const,
  ingredients: [],
  steps: [],
};

// web 경로 테스트용 vision 더미(호출되지 않아야 함)
const dummyVision: ExtractDeps["vision"] = vi.fn(async () => ({ text: "", inputTokens: null }));

const mkFetcher = (
  htmlByUrl: (url: string) => { ok: boolean; status: number; body: string }
): FetchLike =>
  vi.fn((url: string) => {
    const r = htmlByUrl(url);
    return Promise.resolve({ ok: r.ok, status: r.status, text: () => Promise.resolve(r.body) });
  });
const dummyFetcher = mkFetcher(() => ({ ok: true, status: 200, body: "" }));

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("classifyUrl", () => {
  it("youtube/web/무효 분류", () => {
    expect(classifyUrl("https://youtube.com/shorts/abc")).toBe("youtube");
    expect(classifyUrl("https://youtu.be/abc")).toBe("youtube");
    expect(classifyUrl("https://blog.naver.com/x")).toBe("web");
    expect(classifyUrl("ftp://x")).toBeNull();
    expect(classifyUrl("not-url")).toBeNull();
  });
});

describe("판정 순수함수", () => {
  it("missingFields / isPartial / confidence", () => {
    expect(computeMissingFields(fullRecipe)).toEqual([]);
    expect(isPartial(fullRecipe)).toBe(false);
    expect(computeConfidence(fullRecipe)).toBe(1);

    const empty: AiRecipe = { ...fullRecipe, ingredients: [], steps: [] };
    expect(computeMissingFields(empty)).toEqual(["ingredients", "steps"]);
    expect(isPartial(empty)).toBe(true);
    expect(computeConfidence(empty)).toBeLessThan(1);
  });
});

describe("extractRecipeFromUrl — YouTube 2단계(Vision→Structure)", () => {
  it("vision으로 영상 분석 → generate 구조화, method=youtube-vision", async () => {
    const vision = vi.fn<ExtractDeps["vision"]>(async () => ({
      text: "이 영상의 레시피: 재료 돼지고기 300g, 조리순서 볶기 (영상 분석 내용)",
      inputTokens: 12000,
    }));
    const generate = vi.fn<ExtractDeps["generate"]>(async (input) => {
      const part = input.messages[0].content[0] as { text: string };
      expect(part.text).toContain("영상 분석 내용"); // vision 텍스트가 Stage2 입력
      return { object: fullRecipe, usage: { inputTokens: 5000 } };
    });
    const out = await extractRecipeFromUrl("https://youtube.com/shorts/PILBBlFEmLg", {
      fetcher: dummyFetcher,
      generate,
      vision,
    });
    expect(out.sourceType).toBe("youtube");
    expect(out.ingestion.method).toBe("youtube-vision");
    expect(out.recipe.ingredients.length).toBeGreaterThan(0);
    expect(out.recipe.steps.length).toBeGreaterThan(0);
    expect(vision.mock.calls[0][0].model).toBe("gemini-2.5-flash"); // flash 먼저
  });

  it("미인제스트(시청 불가)면 pro 폴백, 둘 다 실패 시 noContent (환각 차단)", async () => {
    const vision = vi.fn<ExtractDeps["vision"]>(async () => ({
      text: "이 영상은 볼 수 없습니다",
      inputTokens: 700000,
    }));
    const generate = vi.fn<ExtractDeps["generate"]>();
    await expect(
      extractRecipeFromUrl("https://youtube.com/watch?v=PILBBlFEmLg", {
        fetcher: dummyFetcher,
        generate,
        vision,
      })
    ).rejects.toMatchObject({ kind: "noContent" });
    expect(vision).toHaveBeenCalledTimes(2); // flash + pro
    expect(generate).not.toHaveBeenCalled(); // 미인제스트라 구조화 안 함
  });

  it("flash 인제스트했으나 재료/순서 0 → pro 폴백으로 성공", async () => {
    const vision = vi.fn<ExtractDeps["vision"]>(async () => ({
      text: "영상을 분석한 레시피입니다. 재료는 돼지고기 300g, 김치 150g 이고 조리순서는 볶고 끓이는 것입니다.",
      inputTokens: 12000,
    }));
    let call = 0;
    const generate = vi.fn<ExtractDeps["generate"]>(async () => {
      call += 1;
      return call === 1
        ? { object: emptyObject, usage: { inputTokens: 100 } } // flash 구조화 빈약
        : { object: fullRecipe, usage: { inputTokens: 200 } }; // pro 성공
    });
    const out = await extractRecipeFromUrl("https://youtube.com/watch?v=PILBBlFEmLg", {
      fetcher: dummyFetcher,
      generate,
      vision,
    });
    expect(out.ingestion.method).toBe("youtube-vision");
    expect(vision).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe("extractRecipeFromUrl — Web 경로 + 공통", () => {
  it("웹 fast-path: JSON-LD 완전 시 모델 우회(generate·vision 미호출)", async () => {
    const html = `<html><head><title>불고기</title></head><body><article><p>본문</p></article>
      <script type="application/ld+json">{"@type":"Recipe","name":"불고기","recipeIngredient":["소고기 300g","간장 3큰술"],"recipeInstructions":[{"@type":"HowToStep","text":"재운다"},{"@type":"HowToStep","text":"굽는다"}]}</script></body></html>`;
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: html }));
    const generate = vi.fn<ExtractDeps["generate"]>();
    const out = await extractRecipeFromUrl("https://blog.example/bulgogi", {
      fetcher,
      generate,
      vision: dummyVision,
    });
    expect(out.sourceType).toBe("web");
    expect(generate).not.toHaveBeenCalled();
    expect(out.recipe.title).toBe("불고기");
    expect(out.recipe.ingredients.map((i) => i.name)).toContain("소고기");
    expect(out.recipe.steps).toHaveLength(2);
  });

  it("웹 모델경유: JSON-LD 불완전 시 본문을 generate 입력으로 전달", async () => {
    const html = `<html><head><title>찌개</title></head><body><article><p>두부 한모를 넣고 끓인다</p></article></body></html>`;
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: html }));
    const generate = vi.fn<ExtractDeps["generate"]>(async (input) => {
      const text = (input.messages[0].content[0] as { text: string }).text;
      expect(text).toContain("두부 한모를 넣고 끓인다");
      return { object: fullRecipe, usage: { inputTokens: 800 } };
    });
    const out = await extractRecipeFromUrl("https://blog.example/jjigae", {
      fetcher,
      generate,
      vision: dummyVision,
    });
    expect(out.sourceType).toBe("web");
    expect(out.ingestion.method).toBe("web-text");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("미지원 URL은 unsupported AiError", async () => {
    await expect(
      extractRecipeFromUrl("ftp://x", { fetcher: dummyFetcher, generate: vi.fn(), vision: dummyVision })
    ).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("웹 전부 빈 결과는 noContent AiError", async () => {
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: "<html></html>" }));
    const generate = vi.fn<ExtractDeps["generate"]>(async () => ({
      object: emptyObject,
      usage: { inputTokens: 100 },
    }));
    await expect(
      extractRecipeFromUrl("https://blog.example/empty", { fetcher, generate, vision: dummyVision })
    ).rejects.toBeInstanceOf(AiError);
  });

  it("키 부재 시 credentials AiError, 아무 호출 없음", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const generate = vi.fn<ExtractDeps["generate"]>();
    const vision = vi.fn<ExtractDeps["vision"]>();
    await expect(
      extractRecipeFromUrl("https://youtube.com/watch?v=PILBBlFEmLg", { fetcher: dummyFetcher, generate, vision })
    ).rejects.toMatchObject({ kind: "credentials" });
    expect(generate).not.toHaveBeenCalled();
    expect(vision).not.toHaveBeenCalled();
  });
});
