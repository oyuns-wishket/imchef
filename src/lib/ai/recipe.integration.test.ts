import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 실 SDK 계약 검증: generateObject를 모듈 모킹해 defaultExtractDeps.generate가
// 올바른 인자 shape(model/schema/system/messages)를 넘기는지 확인한다(라이브 키 불필요).
// vi.hoisted로 mock을 안전하게 끌어올린다(vi.mock factory보다 먼저 초기화).
const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn((_opts: Record<string, unknown>) =>
    Promise.resolve({
      object: {
        title: "제육볶음",
        description: "",
        servings: 1,
        cookTime: null,
        difficulty: "normal",
        ingredients: [{ name: "돼지고기", amount: "300", unit: "g" }],
        steps: [{ content: "볶기" }],
      },
      usage: { inputTokens: 480 },
    })
  ),
}));

vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { defaultExtractDeps, GEMINI_RECIPE_MODEL, aiRecipeSchema } from "./recipe";

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  generateObjectMock.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("defaultExtractDeps.generate (실 generateObject 계약)", () => {
  it("model/schema/system/messages를 정확한 shape로 generateObject에 전달", async () => {
    const messages = [
      { role: "user" as const, content: [{ type: "text" as const, text: "자막 텍스트" }] },
    ];
    const result = await defaultExtractDeps.generate({ messages });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const arg = generateObjectMock.mock.calls[0][0];
    expect(arg.model).toBe(GEMINI_RECIPE_MODEL);
    expect(arg.schema).toBe(aiRecipeSchema);
    expect(typeof arg.system).toBe("string");
    expect(arg.messages).toEqual(messages);

    // 반환 매핑(usage.inputTokens 추출)
    expect(result.usage?.inputTokens).toBe(480);
    expect(result.object.title).toBe("제육볶음");
  });
});
