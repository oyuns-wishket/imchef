import { describe, it, expect } from "vitest";
import { parseIngredientLine } from "./ingredient-parse";

describe("parseIngredientLine", () => {
  it("이름 + 수량 + 단위 분해", () => {
    expect(parseIngredientLine("돼지고기 300g")).toEqual({
      name: "돼지고기",
      amount: "300",
      unit: "g",
    });
    expect(parseIngredientLine("고추장 2큰술")).toEqual({
      name: "고추장",
      amount: "2",
      unit: "큰술",
    });
    expect(parseIngredientLine("물 2컵")).toEqual({ name: "물", amount: "2", unit: "컵" });
    expect(parseIngredientLine("대파 1대")).toEqual({ name: "대파", amount: "1", unit: "대" });
  });

  it("단위 정규화 적용(T→큰술)", () => {
    expect(parseIngredientLine("설탕 2T")).toEqual({
      name: "설탕",
      amount: "2",
      unit: "큰술",
    });
  });

  it("분수 수량", () => {
    expect(parseIngredientLine("양파 1/2개")).toEqual({
      name: "양파",
      amount: "1/2",
      unit: "개",
    });
  });

  it("공백 포함 재료명 보존", () => {
    expect(parseIngredientLine("다진 마늘 1큰술")).toEqual({
      name: "다진 마늘",
      amount: "1",
      unit: "큰술",
    });
  });

  it("모호 수량(약간)", () => {
    expect(parseIngredientLine("소금 약간")).toEqual({
      name: "소금",
      amount: "약간",
      unit: "",
    });
    expect(parseIngredientLine("후추 적당량")).toEqual({
      name: "후추",
      amount: "약간",
      unit: "",
    });
  });

  it("수량 없는 재료는 이름만", () => {
    expect(parseIngredientLine("올리브유")).toEqual({
      name: "올리브유",
      amount: "",
      unit: "",
    });
  });

  it("빈 입력", () => {
    expect(parseIngredientLine("   ")).toEqual({ name: "", amount: "", unit: "" });
  });
});
