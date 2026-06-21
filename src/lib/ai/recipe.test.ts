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

describe("extractRecipeFromUrl (DI 모킹)", () => {
  const mkFetcher = (htmlByUrl: (url: string) => { ok: boolean; status: number; body: string }): FetchLike =>
    vi.fn((url: string) => {
      const r = htmlByUrl(url);
      return Promise.resolve({ ok: r.ok, status: r.status, text: () => Promise.resolve(r.body) });
    });

  it("YouTube 자막 경로: 자막을 generate 입력으로 전달, 후처리 적용", async () => {
    const watchHtml = `<script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://timedtext/ko","languageCode":"ko"}]}}};</script>`;
    const xml = `<transcript><text>고추장 2큰술</text></transcript>`;
    const fetcher = mkFetcher((url) =>
      url.includes("timedtext")
        ? { ok: true, status: 200, body: xml }
        : { ok: true, status: 200, body: watchHtml }
    );
    const generate = vi.fn<ExtractDeps["generate"]>(async (input) => {
      // 자막 텍스트가 모델 입력에 포함됐는지 검증
      const text = input.messages[0].content.find((p) => p.type === "text");
      expect((text as { text: string }).text).toContain("고추장 2큰술");
      return { object: { ...fullRecipe, title: "제육볶음 (Jeyuk)" }, usage: { inputTokens: 5000 } };
    });
    const deps: ExtractDeps = { fetcher, generate };

    const out = await extractRecipeFromUrl("https://youtube.com/shorts/PILBBlFEmLg", deps);
    expect(out.sourceType).toBe("youtube");
    expect(out.ingestion.method).toBe("transcript");
    expect(out.recipe.title).toBe("제육볶음"); // 후처리로 영문병기 제거
    expect(out.partial).toBe(false);
  });

  it("자막 없으면 noContent로 정직하게 실패(깨진 영상 폴백·환각 prefill 없음)", async () => {
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: "<html>no captions</html>" }));
    const generate = vi.fn<ExtractDeps["generate"]>();
    await expect(
      extractRecipeFromUrl("https://youtube.com/watch?v=PILBBlFEmLg", { fetcher, generate })
    ).rejects.toMatchObject({ kind: "noContent" });
    // 모델은 호출되지 않는다(환각 생성 차단)
    expect(generate).not.toHaveBeenCalled();
  });

  it("웹 fast-path: JSON-LD 완전 시 모델 우회(generate 미호출)", async () => {
    const html = `<html><head><title>불고기</title></head><body><article><p>본문</p></article>
      <script type="application/ld+json">{"@type":"Recipe","name":"불고기","recipeIngredient":["소고기 300g","간장 3큰술"],"recipeInstructions":[{"@type":"HowToStep","text":"재운다"},{"@type":"HowToStep","text":"굽는다"}]}</script></body></html>`;
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: html }));
    const generate = vi.fn<ExtractDeps["generate"]>();
    const out = await extractRecipeFromUrl("https://blog.example/bulgogi", { fetcher, generate });
    expect(out.sourceType).toBe("web");
    expect(generate).not.toHaveBeenCalled(); // 모델 우회
    expect(out.recipe.title).toBe("불고기");
    expect(out.recipe.ingredients.map((i) => i.name)).toContain("소고기");
    expect(out.recipe.steps).toHaveLength(2);
    expect(out.partial).toBe(false);
  });

  it("웹 모델경유: JSON-LD 불완전 시 본문을 generate 입력으로 전달", async () => {
    const html = `<html><head><title>찌개</title></head><body><article><p>두부 한모를 넣고 끓인다</p></article></body></html>`;
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: html }));
    const generate = vi.fn<ExtractDeps["generate"]>(async (input) => {
      const text = (input.messages[0].content[0] as { text: string }).text;
      expect(text).toContain("두부 한모를 넣고 끓인다");
      return { object: fullRecipe, usage: { inputTokens: 800 } };
    });
    const out = await extractRecipeFromUrl("https://blog.example/jjigae", { fetcher, generate });
    expect(out.sourceType).toBe("web");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("미지원 URL은 unsupported AiError", async () => {
    const deps: ExtractDeps = {
      fetcher: mkFetcher(() => ({ ok: true, status: 200, body: "" })),
      generate: vi.fn(),
    };
    await expect(extractRecipeFromUrl("ftp://x", deps)).rejects.toMatchObject({
      kind: "unsupported",
    });
  });

  it("전부 빈 결과는 noContent AiError", async () => {
    const fetcher = mkFetcher(() => ({ ok: true, status: 200, body: "<html></html>" }));
    const generate = vi.fn(async () => ({
      object: {
        title: "",
        description: "",
        servings: 1,
        cookTime: null,
        difficulty: "normal" as const,
        ingredients: [],
        steps: [],
      },
      usage: { inputTokens: 100 },
    }));
    await expect(
      extractRecipeFromUrl("https://blog.example/empty", { fetcher, generate })
    ).rejects.toBeInstanceOf(AiError);
  });

  it("키 부재 시 credentials AiError", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const deps: ExtractDeps = {
      fetcher: mkFetcher(() => ({ ok: true, status: 200, body: "" })),
      generate: vi.fn(),
    };
    await expect(
      extractRecipeFromUrl("https://blog.example/x", deps)
    ).rejects.toMatchObject({ kind: "credentials" });
    expect(deps.generate).not.toHaveBeenCalled();
  });
});
