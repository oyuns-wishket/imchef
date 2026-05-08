"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function MyRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();

      if (!me.user) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/recipes?userId=${me.user.id}`);
      const data = await res.json();
      setRecipes(data);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          내 레시피
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          내가 등록한 레시피 목록
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400">불러오는 중...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">
            아직 등록한 레시피가 없습니다.
          </p>
          <button
            onClick={() => router.push("/recipes/new")}
            className="btn-primary"
          >
            첫 레시피 작성하기
          </button>
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
