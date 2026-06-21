/**
 * 결정론적 web fast-path(JSON-LD) 추출 경로의 4요소 회귀 측정기.
 *
 * ⚠️ 범위 정직성(critic 지적 반영): 이것은 이슈 #8의 전체 KPI("모든 URL 추출 ≥90%")가
 * 아니다. 라이브 모델/유튜브가 없는 CI에서 **결정론적으로 재현 가능한** 슬라이스
 * (schema.org/Recipe JSON-LD 파싱 → jsonLdToRecipe → 후처리)만 측정한다.
 * 모델 경유 web 경로·YouTube 자막 경로의 실제 성공률은 여기서 측정되지 않으며,
 * 라이브 키 확보 시 녹화 응답 기반 회귀로 별도 검증해야 한다.
 */
import { extractRecipeJsonLd, jsonLdToRecipe } from "@/lib/ai/extract/web";
import { postProcessRecipe } from "@/lib/ai/postprocess";

export interface GoldenExpectation {
  /** 후처리 후 기대 제목(영문병기 제거된 형태). */
  title: string;
  /** 기대 재료명(부분일치 허용). 순서 무관, 전부 존재해야 함. */
  ingredientNames: string[];
  /** 조리 단계별 기대 키워드(순서대로, 부분일치). */
  steps: string[];
}

export interface GoldenCase {
  id: string;
  html: string;
  expected: GoldenExpectation;
}

export interface ElementResult {
  title: boolean;
  ingredients: boolean;
  steps: boolean;
  order: boolean;
}

export interface CaseResult {
  id: string;
  success: boolean;
  elements: ElementResult;
}

function matchTitle(actual: string, expected: string): boolean {
  const a = actual.trim();
  const e = expected.trim();
  return a === e || a.includes(e) || e.includes(a);
}

function matchIngredients(
  actual: { name: string }[],
  expectedNames: string[]
): boolean {
  if (actual.length < expectedNames.length) return false;
  return expectedNames.every((name) =>
    actual.some((ing) => ing.name.includes(name) || name.includes(ing.name))
  );
}

/** 단계 수 일치 + 각 단계가 순서대로 기대 키워드를 포함(내용 + 순서). */
function matchSteps(
  actual: { content: string }[],
  expectedSteps: string[]
): { content: boolean; order: boolean } {
  const content =
    actual.length === expectedSteps.length &&
    expectedSteps.every((kw) => actual.some((s) => s.content.includes(kw)));
  const order =
    actual.length === expectedSteps.length &&
    expectedSteps.every((kw, i) => actual[i]?.content.includes(kw));
  return { content, order };
}

export function evaluateCase(c: GoldenCase): CaseResult {
  const jsonLd = extractRecipeJsonLd(c.html);
  if (!jsonLd) {
    return {
      id: c.id,
      success: false,
      elements: { title: false, ingredients: false, steps: false, order: false },
    };
  }
  const recipe = postProcessRecipe(jsonLdToRecipe(jsonLd));

  const title = matchTitle(recipe.title, c.expected.title);
  const ingredients = matchIngredients(recipe.ingredients, c.expected.ingredientNames);
  const { content: steps, order } = matchSteps(recipe.steps, c.expected.steps);

  const elements = { title, ingredients, steps, order };
  const success = title && ingredients && steps && order;
  return { id: c.id, success, elements };
}

export interface GoldenReport {
  total: number;
  success: number;
  rate: number;
  results: CaseResult[];
  failures: CaseResult[];
}

export function evaluateGolden(cases: GoldenCase[]): GoldenReport {
  const results = cases.map(evaluateCase);
  const success = results.filter((r) => r.success).length;
  return {
    total: cases.length,
    success,
    rate: cases.length === 0 ? 0 : success / cases.length,
    results,
    failures: results.filter((r) => !r.success),
  };
}
