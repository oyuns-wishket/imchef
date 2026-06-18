"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import RecipeForm from "@/components/RecipeForm";

interface RecipeData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string }[];
  images: { url: string }[];
  referenceUrl: string | null;
  userId: string;
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, recipeRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/recipes/${id}`),
        ]);

        const me = await meRes.json();
        if (!me.user) {
          router.push("/login");
          return;
        }

        const data = await recipeRes.json();
        if (!recipeRes.ok || !data || data.userId !== me.user.id) {
          router.push(`/recipes/${id}`);
          return;
        }

        setRecipe(data);
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-stone-400 text-sm">
          레시피를 불러올 수 없습니다.
        </p>
      </main>
    );
  }

  if (loading || !recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-stone-400 text-sm">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-stone-900 mb-8">레시피 수정</h1>
      <RecipeForm
        recipeId={id}
        initialData={{
          title: recipe.title,
          description: recipe.description || "",
          servings: recipe.servings,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          imageUrls: recipe.images.map((img) => img.url),
          referenceUrl: recipe.referenceUrl || "",
        }}
      />
    </main>
  );
}
