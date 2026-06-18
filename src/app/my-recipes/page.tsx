"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import { useAuth } from "@/contexts/AuthContext";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  cookTime: number | null;
  difficulty: string;
  user: { nickname: string };
  images: { url: string }[];
  createdAt: string;
}

export default function MyRecipesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    fetch(`/api/recipes?userId=${user.id}&limit=60`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [user, authLoading, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) =>
      [r.title, r.description ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [recipes, query]);

  if (authLoading || loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line overflow-hidden">
              <div className="aspect-[4/3] bg-mist animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-mist animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-mist animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-grass-600">
            My Kitchen
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            내 레시피
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            내가 등록한 레시피 {recipes.length}개
          </p>
        </div>
        <Link href="/recipes/new" className="btn-primary self-start sm:self-auto">
          + 레시피 등록
        </Link>
      </div>

      {recipes.length > 0 && (
        <div className="relative mb-6 max-w-md">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내 레시피 검색"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-line text-sm
                       placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-grass-400
                       focus:border-grass-400 transition-all"
          />
        </div>
      )}

      {error ? (
        <EmptyState
          emoji="🥕"
          title="레시피를 불러오지 못했어요"
          desc="잠시 후 다시 시도해주세요."
        />
      ) : recipes.length === 0 ? (
        <EmptyState
          emoji="🍳"
          title="아직 등록한 레시피가 없어요"
          desc="첫 레시피를 등록해보세요."
          action={
            <Link href="/recipes/new" className="btn-primary mt-5">
              레시피 등록하기
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="검색 결과가 없어요"
          desc={`‘${query.trim()}’에 맞는 레시피가 없어요.`}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              nickname={recipe.user?.nickname ?? "익명"}
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

function EmptyState({
  emoji,
  title,
  desc,
  action,
}: {
  emoji: string;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-20">
      <div className="text-4xl mb-4" aria-hidden>
        {emoji}
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft max-w-xs">{desc}</p>
      {action}
    </div>
  );
}
