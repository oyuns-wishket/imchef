/**
 * 추출 결과 후처리(완성도 보정) — 순수 함수.
 *
 * 이슈 #8: title 영문 병기 제거, 단위 정규화, 단계 정렬/정리, 빈 항목 제거를
 * 후처리 단으로 일원화한다. 모델 출력의 비결정성을 결정적으로 다듬는 계층.
 */

export interface RawIngredient {
  name: string;
  amount: string;
  unit: string;
}
export interface RawStep {
  content: string;
}
export interface RawRecipe {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: "easy" | "normal" | "hard";
  ingredients: RawIngredient[];
  steps: RawStep[];
}

/**
 * 제목 정제: 영문 병기 괄호 제거 + 따옴표/공백 정리.
 * - "제육볶음 (Jeyuk-bokkeum recipe)" → "제육볶음"
 * - 한글이 포함된 괄호(예: "(매운맛)")는 의미가 있으므로 보존.
 */
export function cleanTitle(title: string): string {
  let t = title.trim();
  // 영문/숫자/구두점만으로 이뤄진 괄호 블록 제거(한글 미포함)
  t = t.replace(/\s*[([{][^)\]}]*[)\]}]/g, (m) => (/[가-힣]/.test(m) ? m : ""));
  // 장식 특수문자(하트/별/음표/물결 등 — 실제 레시피 사이트 제목에 흔함) → 공백
  t = t.replace(/[♥♡❤❥★☆✦✧✩※♪♬♩◆◇▶◀【】]/gu, " ");
  // 양끝 따옴표/물결 장식 제거
  t = t.replace(/^['"“”‘’~∼]+|['"“”‘’~∼]+$/g, "");
  return t.replace(/\s+/g, " ").trim();
}

const UNIT_MAP: Record<string, string> = {
  그램: "g",
  그람: "g",
  g: "g",
  킬로그램: "kg",
  킬로: "kg",
  kg: "kg",
  밀리리터: "ml",
  ml: "ml",
  리터: "L",
  l: "L",
  L: "L",
  컵: "컵",
  큰술: "큰술",
  스푼: "큰술",
  테이블스푼: "큰술",
  t: "작은술", // 소문자 t = tsp
  tsp: "작은술",
  티스푼: "작은술",
  작은술: "작은술",
  T: "큰술", // 대문자 T = tbsp
  tbsp: "큰술",
};

/** 단위 표기 정규화. 매핑에 없으면 원본 trim 유지(개/알/장/줌/꼬집/약간/적당량 등). */
export function normalizeUnit(rawUnit: string): string {
  const u = rawUnit.trim();
  if (!u) return "";
  if (Object.prototype.hasOwnProperty.call(UNIT_MAP, u)) return UNIT_MAP[u];
  const lower = u.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(UNIT_MAP, lower)) return UNIT_MAP[lower];
  return u;
}

export function normalizeIngredient(ing: RawIngredient): RawIngredient {
  const name = ing.name.trim();
  let amount = ing.amount.trim();
  let unit = normalizeUnit(ing.unit);
  // 분해 불가(예: "소금 약간") 보정
  if (!amount && /약간|적당량|조금/.test(name)) {
    amount = "약간";
    unit = "";
  }
  return { name, amount, unit };
}

/** 재료: 정규화 + 빈 이름 제거. */
export function cleanIngredients(ingredients: RawIngredient[]): RawIngredient[] {
  return ingredients
    .map(normalizeIngredient)
    .filter((ing) => ing.name.length > 0);
}

/** 단계: trim + 빈 단계 제거(배열 순서가 곧 조리 순서). */
export function cleanSteps(steps: RawStep[]): RawStep[] {
  return steps
    .map((s) => ({ content: s.content.trim() }))
    .filter((s) => s.content.length > 0);
}

/** 레시피 전체 후처리. */
export function postProcessRecipe(recipe: RawRecipe): RawRecipe {
  return {
    ...recipe,
    title: cleanTitle(recipe.title),
    description: recipe.description.trim(),
    ingredients: cleanIngredients(recipe.ingredients),
    steps: cleanSteps(recipe.steps),
  };
}
