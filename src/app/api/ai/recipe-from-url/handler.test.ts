import { describe, it, expect, vi } from "vitest";
import { handleRecipeFromUrl, type RecipeRouteDeps } from "./handler";
import { AiError } from "@/lib/ai/errors";
import type { ExtractRecipeResult } from "@/lib/ai/recipe";

const okResult: ExtractRecipeResult = {
  recipe: {
    title: "제육볶음",
    description: "매콤",
    servings: 2,
    cookTime: 30,
    difficulty: "normal",
    ingredients: [{ name: "돼지고기", amount: "300", unit: "g" }],
    steps: [{ content: "양념" }, { content: "볶기" }],
  },
  sourceType: "web",
  confidence: 1,
  partial: false,
  missingFields: [],
  ingestion: { method: "web-text", inputTokens: 800 },
};

const mkReq = (body: unknown) =>
  new Request("http://localhost/api/ai/recipe-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("handleRecipeFromUrl", () => {
  it("정상 추출 → 200 + recipe(referenceUrl) + meta", async () => {
    const deps: RecipeRouteDeps = {
      getUserId: async () => "u1",
      extract: vi.fn(async () => okResult),
    };
    const res = await handleRecipeFromUrl(mkReq({ url: "https://blog.example/x" }), deps);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recipe.title).toBe("제육볶음");
    expect(json.recipe.referenceUrl).toBe("https://blog.example/x");
    expect(json.meta.partial).toBe(false);
    expect(json.meta.sourceType).toBe("web");
  });

  it("미인증 → 401, extract 미호출", async () => {
    const extract = vi.fn();
    const res = await handleRecipeFromUrl(mkReq({ url: "https://blog.example/x" }), {
      getUserId: async () => null,
      extract,
    });
    expect(res.status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it("URL 형식 불량 → 400", async () => {
    const res = await handleRecipeFromUrl(mkReq({ url: "not-a-url" }), {
      getUserId: async () => "u1",
      extract: vi.fn(),
    });
    expect(res.status).toBe(400);
  });

  it("미지원 스킴(ftp) → 415", async () => {
    const res = await handleRecipeFromUrl(mkReq({ url: "ftp://files.example/x" }), {
      getUserId: async () => "u1",
      extract: vi.fn(),
    });
    expect(res.status).toBe(415);
  });

  it("콘텐츠 부족(noContent) → 422", async () => {
    const res = await handleRecipeFromUrl(mkReq({ url: "https://blog.example/x" }), {
      getUserId: async () => "u1",
      extract: async () => {
        throw new AiError("noContent");
      },
    });
    expect(res.status).toBe(422);
  });

  it("키 부재(credentials) → 500 + 친화 메시지", async () => {
    const res = await handleRecipeFromUrl(mkReq({ url: "https://blog.example/x" }), {
      getUserId: async () => "u1",
      extract: async () => {
        throw new AiError("credentials");
      },
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("직접 입력");
    expect(json.error).not.toMatch(/AI_GATEWAY_API_KEY/);
  });

  it("쿼터 초과(rateLimit) → 429", async () => {
    const res = await handleRecipeFromUrl(mkReq({ url: "https://blog.example/x" }), {
      getUserId: async () => "u1",
      extract: async () => {
        throw new Error("HTTP 429 quota exceeded");
      },
    });
    expect(res.status).toBe(429);
  });
});
