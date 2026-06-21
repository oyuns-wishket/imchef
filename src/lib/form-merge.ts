/**
 * RecipeForm의 prefill 병합/매핑 순수 로직(명세 05 §7).
 *
 * 컴포넌트에서 분리해 단위 테스트한다: 단계 순서·재료 단위가 깨지지 않고,
 * 빈 폼이면 덮어쓰기 / 입력 중이면(상위에서 확인 후) 병합, referenceUrl은
 * 비어 있을 때만 주입한다.
 */

export interface ImportedRecipeData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: "easy" | "normal" | "hard";
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string }[];
  referenceUrl: string;
}

export interface FormSnapshot {
  title: string;
  description: string;
  servings: number;
  cookTime: number | "";
  difficulty: string;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string }[];
  referenceUrl: string;
}

export function isFormEmpty(s: FormSnapshot): boolean {
  return (
    !s.title.trim() &&
    !s.description.trim() &&
    s.servings === 1 &&
    s.cookTime === "" &&
    s.difficulty === "normal" &&
    s.ingredients.every((i) => !i.name.trim()) &&
    s.steps.every((st) => !st.content.trim()) &&
    !s.referenceUrl.trim()
  );
}

/**
 * 추출 재료를 폼 재료로 매핑(순서 보존). 추출 단위를 그대로 보존한다 —
 * 빈 단위를 "g"로 강제하면 "계란 3개"가 "계란 3g"로 오염되므로 빈 값을 유지하고
 * 사용자가 폼에서 조정하게 둔다(명세 05 §6: 빈 단위 허용).
 */
export function mapImportedIngredients(
  ingredients: ImportedRecipeData["ingredients"]
): FormSnapshot["ingredients"] {
  return ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
  }));
}

/** 추출 단계를 폼 단계로 매핑(배열 순서 = 조리 순서, 보존). */
export function mapImportedSteps(
  steps: ImportedRecipeData["steps"]
): FormSnapshot["steps"] {
  return steps.map((s) => ({ content: s.content }));
}

export type PrefillPatch = Partial<FormSnapshot>;

/**
 * 추출 결과로 폼에 적용할 패치를 만든다. 빈 추출 필드는 현재 값을 보존하고,
 * referenceUrl은 현재 비어 있을 때만 주입한다.
 */
export function buildPrefillPatch(
  current: FormSnapshot,
  incoming: ImportedRecipeData
): PrefillPatch {
  const patch: PrefillPatch = {};

  if (incoming.title) patch.title = incoming.title;
  if (incoming.description) patch.description = incoming.description;
  if (incoming.servings && incoming.servings !== 1) patch.servings = incoming.servings;
  if (incoming.cookTime !== null) patch.cookTime = incoming.cookTime;
  if (incoming.difficulty) patch.difficulty = incoming.difficulty;
  if (incoming.ingredients.length > 0) {
    patch.ingredients = mapImportedIngredients(incoming.ingredients);
  }
  if (incoming.steps.length > 0) {
    patch.steps = mapImportedSteps(incoming.steps);
  }
  if (!current.referenceUrl.trim() && incoming.referenceUrl) {
    patch.referenceUrl = incoming.referenceUrl;
  }

  return patch;
}

const MISSING_LABELS: Record<string, string> = {
  title: "제목",
  ingredients: "재료",
  steps: "조리순서",
};

/** missingFields(["ingredients","steps"]) → "재료, 조리순서". */
export function formatMissingFields(fields: string[]): string {
  return fields.map((f) => MISSING_LABELS[f] ?? f).join(", ");
}
