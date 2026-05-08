"use client";

import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";

interface Recipe {
  id: string;
  title: string;
  cookTime: number | null;
  difficulty: string;
  user: { nickname: string };
  images: { url: string }[];
  createdAt: string;
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then((data) => {
        setRecipes(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          레시피
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          모든 레시피를 둘러보세요
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400">불러오는 중...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm">
            아직 등록된 레시피가 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              nickname={recipe.user.nickname}
              cookTime={recipe.cookTime}
              difficulty={recipe.difficulty}
              imageUrl={recipe.images[0]?.url || null}
              createdAt={recipe.createdAt}
            />
          ))}
        </div>
      )}
    </main>
  );
}
