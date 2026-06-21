import { describe, it, expect } from "vitest";
import {
  cleanTitle,
  normalizeUnit,
  normalizeIngredient,
  cleanIngredients,
  cleanSteps,
  postProcessRecipe,
  type RawRecipe,
} from "./postprocess";

describe("cleanTitle", () => {
  it("영문 병기 괄호 제거 (repro 케이스)", () => {
    expect(
      cleanTitle("많은 분들이 좋아해주신 제육볶음 레시피 (Many people liked Jeyuk-bokkeum recipe)")
    ).toBe("많은 분들이 좋아해주신 제육볶음 레시피");
  });

  it("한글 포함 괄호는 보존", () => {
    expect(cleanTitle("김치찌개 (매운맛)")).toBe("김치찌개 (매운맛)");
  });

  it("장식 특수문자(♥★~) 제거 (실제 만개의레시피 케이스)", () => {
    expect(cleanTitle("부드럽게 먹는♥돼지고기장조림")).toBe("부드럽게 먹는 돼지고기장조림");
    expect(cleanTitle("★초간단★ 계란찜")).toBe("초간단 계란찜");
    expect(cleanTitle("매콤 닭볶음탕~")).toBe("매콤 닭볶음탕");
  });

  it("양끝 따옴표 제거 + 공백 정리", () => {
    expect(cleanTitle('  "제육볶음"  ')).toBe("제육볶음");
    expect(cleanTitle("불고기   덮밥")).toBe("불고기 덮밥");
  });
});

describe("normalizeUnit", () => {
  it("무게/부피/계량 정규화", () => {
    expect(normalizeUnit("그램")).toBe("g");
    expect(normalizeUnit("킬로그램")).toBe("kg");
    expect(normalizeUnit("밀리리터")).toBe("ml");
    expect(normalizeUnit("리터")).toBe("L");
    expect(normalizeUnit("큰술")).toBe("큰술");
    expect(normalizeUnit("tbsp")).toBe("큰술");
    expect(normalizeUnit("tsp")).toBe("작은술");
    expect(normalizeUnit("T")).toBe("큰술");
    expect(normalizeUnit("t")).toBe("작은술");
  });

  it("매핑 없는 단위(개/줌/약간)는 원본 유지", () => {
    expect(normalizeUnit("개")).toBe("개");
    expect(normalizeUnit("줌")).toBe("줌");
    expect(normalizeUnit("약간")).toBe("약간");
    expect(normalizeUnit("")).toBe("");
  });
});

describe("normalizeIngredient", () => {
  it("'소금 약간'처럼 분해불가는 amount=약간", () => {
    expect(normalizeIngredient({ name: "소금 약간", amount: "", unit: "" })).toEqual({
      name: "소금 약간",
      amount: "약간",
      unit: "",
    });
  });
  it("trim + 단위 정규화", () => {
    expect(normalizeIngredient({ name: " 설탕 ", amount: " 2 ", unit: "큰술" })).toEqual({
      name: "설탕",
      amount: "2",
      unit: "큰술",
    });
  });
});

describe("cleanIngredients / cleanSteps", () => {
  it("빈 이름 재료 제거", () => {
    expect(
      cleanIngredients([
        { name: "양파", amount: "1", unit: "개" },
        { name: "  ", amount: "", unit: "" },
      ])
    ).toHaveLength(1);
  });
  it("빈 단계 제거 + trim, 순서 유지", () => {
    expect(
      cleanSteps([{ content: " 썰기 " }, { content: "" }, { content: "볶기" }])
    ).toEqual([{ content: "썰기" }, { content: "볶기" }]);
  });
});

describe("postProcessRecipe", () => {
  it("전체 보정 통합", () => {
    const raw: RawRecipe = {
      title: '제육볶음 (Jeyuk recipe)',
      description: "  매콤한 제육  ",
      servings: 2,
      cookTime: 30,
      difficulty: "normal",
      ingredients: [
        { name: " 돼지고기 ", amount: "300", unit: "그램" },
        { name: "", amount: "", unit: "" },
      ],
      steps: [{ content: "고기 양념" }, { content: "  " }, { content: "볶기" }],
    };
    const out = postProcessRecipe(raw);
    expect(out.title).toBe("제육볶음");
    expect(out.description).toBe("매콤한 제육");
    expect(out.ingredients).toEqual([{ name: "돼지고기", amount: "300", unit: "g" }]);
    expect(out.steps).toEqual([{ content: "고기 양념" }, { content: "볶기" }]);
  });
});
