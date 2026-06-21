import { describe, it, expect } from "vitest";
import {
  isFormEmpty,
  mapImportedIngredients,
  mapImportedSteps,
  buildPrefillPatch,
  formatMissingFields,
  type FormSnapshot,
  type ImportedRecipeData,
} from "./form-merge";

const emptyForm: FormSnapshot = {
  title: "",
  description: "",
  servings: 1,
  cookTime: "",
  difficulty: "normal",
  ingredients: [{ name: "", amount: "", unit: "g" }],
  steps: [{ content: "" }],
  referenceUrl: "",
};

const imported: ImportedRecipeData = {
  title: "제육볶음",
  description: "매콤",
  servings: 2,
  cookTime: 30,
  difficulty: "normal",
  ingredients: [
    { name: "돼지고기", amount: "300", unit: "g" },
    { name: "고추장", amount: "2", unit: "" }, // 단위 빈값
  ],
  steps: [{ content: "재운다" }, { content: "볶는다" }],
  referenceUrl: "https://youtu.be/x",
};

describe("isFormEmpty", () => {
  it("기본값 폼은 빈 폼", () => {
    expect(isFormEmpty(emptyForm)).toBe(true);
  });
  it("한 필드라도 채워지면 비어있지 않음", () => {
    expect(isFormEmpty({ ...emptyForm, title: "x" })).toBe(false);
    expect(isFormEmpty({ ...emptyForm, ingredients: [{ name: "양파", amount: "", unit: "g" }] })).toBe(
      false
    );
  });
});

describe("mapImportedIngredients", () => {
  it("추출 단위를 보존(빈 값을 'g'로 강제하지 않음), 순서 보존", () => {
    const out = mapImportedIngredients(imported.ingredients);
    expect(out).toEqual([
      { name: "돼지고기", amount: "300", unit: "g" },
      { name: "고추장", amount: "2", unit: "" }, // 빈 단위 유지(오염 방지)
    ]);
  });
});

describe("mapImportedSteps", () => {
  it("단계 순서 보존", () => {
    expect(mapImportedSteps([{ content: "a" }, { content: "b" }, { content: "c" }])).toEqual([
      { content: "a" },
      { content: "b" },
      { content: "c" },
    ]);
  });
});

describe("buildPrefillPatch", () => {
  it("빈 폼이면 모든 추출 필드로 패치(순서/단위 보존)", () => {
    const patch = buildPrefillPatch(emptyForm, imported);
    expect(patch.title).toBe("제육볶음");
    expect(patch.servings).toBe(2);
    expect(patch.cookTime).toBe(30);
    expect(patch.ingredients).toEqual([
      { name: "돼지고기", amount: "300", unit: "g" },
      { name: "고추장", amount: "2", unit: "" },
    ]);
    expect(patch.steps).toEqual([{ content: "재운다" }, { content: "볶는다" }]);
    expect(patch.referenceUrl).toBe("https://youtu.be/x");
  });

  it("빈 추출 필드는 패치에 넣지 않아 현재 값 보존", () => {
    const sparse: ImportedRecipeData = {
      title: "",
      description: "",
      servings: 1,
      cookTime: null,
      difficulty: "normal",
      ingredients: [],
      steps: [],
      referenceUrl: "",
    };
    const patch = buildPrefillPatch(emptyForm, sparse);
    expect(patch.title).toBeUndefined();
    expect(patch.cookTime).toBeUndefined();
    expect(patch.ingredients).toBeUndefined();
    expect(patch.steps).toBeUndefined();
  });

  it("referenceUrl은 현재 비어 있을 때만 주입(기존 값 보존)", () => {
    const withRef: FormSnapshot = { ...emptyForm, referenceUrl: "https://keep.me" };
    const patch = buildPrefillPatch(withRef, imported);
    expect(patch.referenceUrl).toBeUndefined();
  });
});

describe("formatMissingFields", () => {
  it("필드 키를 한국어 라벨로", () => {
    expect(formatMissingFields(["ingredients", "steps"])).toBe("재료, 조리순서");
    expect(formatMissingFields(["title"])).toBe("제목");
  });
});
