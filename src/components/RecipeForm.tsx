"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IngredientInput from "./IngredientInput";
import StepInput from "./StepInput";
import ImageUploader from "./ImageUploader";
import Spinner from "@/components/ui/Spinner";
import UrlRecipeImport, { type ImportedRecipe } from "./UrlRecipeImport";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Step {
  content: string;
}

interface RecipeData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  ingredients: Ingredient[];
  steps: Step[];
  imageUrls: string[];
  referenceUrl: string;
}

interface Props {
  initialData?: RecipeData;
  recipeId?: string;
}

const DIFFICULTIES = [
  { value: "easy", label: "쉬움" },
  { value: "normal", label: "보통" },
  { value: "hard", label: "어려움" },
];

export default function RecipeForm({ initialData, recipeId }: Props) {
  const router = useRouter();
  const isEditing = !!recipeId;

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [servings, setServings] = useState(initialData?.servings || 1);
  const [cookTime, setCookTime] = useState<number | "">(initialData?.cookTime || "");
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || "normal");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialData?.ingredients || [{ name: "", amount: "", unit: "g" }]
  );
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps || [{ content: "" }]
  );
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [referenceUrl, setReferenceUrl] = useState(initialData?.referenceUrl || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── prefill 병합 전략 (명세 §7) ──────────────────────────────────────────
  function isFormEmpty(): boolean {
    return (
      !title.trim() &&
      !description.trim() &&
      servings === 1 &&
      cookTime === "" &&
      difficulty === "normal" &&
      ingredients.every((ing) => !ing.name.trim()) &&
      steps.every((s) => !s.content.trim()) &&
      !referenceUrl.trim()
    );
  }

  function applyPrefill(recipe: ImportedRecipe) {
    setTitle(recipe.title || title);
    setDescription(recipe.description || description);
    if (recipe.servings && recipe.servings !== 1) setServings(recipe.servings);
    if (recipe.cookTime !== null) setCookTime(recipe.cookTime);
    if (recipe.difficulty) setDifficulty(recipe.difficulty);
    if (recipe.ingredients.length > 0) {
      setIngredients(
        recipe.ingredients.map((ing) => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit || "g",
        }))
      );
    }
    if (recipe.steps.length > 0) {
      setSteps(recipe.steps.map((s) => ({ content: s.content })));
    }
    // referenceUrl: 비어있을 때만 주입
    if (!referenceUrl.trim() && recipe.referenceUrl) {
      setReferenceUrl(recipe.referenceUrl);
    }
  }

  function handleUrlImportResult(recipe: ImportedRecipe) {
    if (isFormEmpty()) {
      applyPrefill(recipe);
    } else {
      const ok = window.confirm(
        "AI 결과로 폼을 채우면 입력하신 내용을 덮어쓸 수 있어요. 진행할까요?"
      );
      if (ok) applyPrefill(recipe);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validIngredients = ingredients.filter((ing) => ing.name.trim());
    const validSteps = steps.filter((step) => step.content.trim());

    if (!title.trim()) {
      setError("레시피 제목을 입력해주세요.");
      return;
    }
    if (validIngredients.length === 0) {
      setError("재료를 최소 1개 이상 입력해주세요.");
      return;
    }
    if (validSteps.length === 0) {
      setError("조리 순서를 최소 1단계 이상 입력해주세요.");
      return;
    }

    setLoading(true);

    const body = {
      title: title.trim(),
      description: description.trim(),
      servings,
      cookTime: cookTime || null,
      difficulty,
      ingredients: validIngredients,
      steps: validSteps,
      imageUrls,
      referenceUrl: referenceUrl.trim() || null,
    };

    const url = isEditing ? `/api/recipes/${recipeId}` : "/api/recipes";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "저장에 실패했습니다.");
      setLoading(false);
      return;
    }

    const recipe = await res.json();
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* URL→AI 레시피 자동생성 — 신규 등록 흐름에서만 노출 (수정 모드 제외) */}
      {!isEditing && (
        <UrlRecipeImport onResult={handleUrlImportResult} />
      )}

      <ImageUploader images={imageUrls} onChange={setImageUrls} />

      <div>
        <label className="text-sm font-medium text-ink">레시피 제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 엄마표 된장찌개"
          className="input-field mt-1.5"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink">
          소개 <span className="text-ink-faint font-normal">(선택)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="이 레시피에 대해 간단히 설명해주세요"
          rows={3}
          className="input-field mt-1.5 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-ink">인분</label>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-9 h-9 rounded-2xl bg-white/60 text-ink-soft hover:bg-white/80 transition-colors flex items-center justify-center"
            >
              -
            </button>
            <span className="text-sm font-medium text-ink w-8 text-center">
              {servings}
            </span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="w-9 h-9 rounded-2xl bg-white/60 text-ink-soft hover:bg-white/80 transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink">조리시간</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="30"
              className="input-field w-20"
              min={0}
            />
            <span className="text-sm text-ink-faint">분</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink">난이도</label>
          <div className="flex gap-1.5 mt-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                className={`px-3 py-2 rounded-2xl text-xs font-medium transition-colors ${
                  difficulty === d.value
                    ? "bg-ink text-white"
                    : "bg-white/60 text-ink-soft hover:bg-white/80"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-line" />

      <IngredientInput ingredients={ingredients} onChange={setIngredients} />

      <hr className="border-line" />

      <StepInput steps={steps} onChange={setSteps} />

      <hr className="border-line" />

      <div>
        <label className="text-sm font-medium text-ink">
          참고 링크 <span className="text-ink-faint font-normal">(선택)</span>
        </label>
        <input
          type="url"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="https://example.com/recipe"
          className="input-field mt-1.5"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          취소
        </button>
        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={loading}>
          {loading && <Spinner size="sm" label="저장 중" />}
          {loading ? "저장 중..." : isEditing ? "수정하기" : "레시피 등록"}
        </button>
      </div>
    </form>
  );
}
