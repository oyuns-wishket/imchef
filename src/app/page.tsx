"use client";

import { useEffect, useMemo, useState } from "react";
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

type SortKey = "newest" | "oldest" | "title";

const POPULAR = ["에어프라이어", "자취요리", "김치찌개", "간단안주", "다이어트", "비건"];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" },
  { key: "title", label: "이름순" },
];

export default function Home() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    fetch("/api/recipes?limit=60")
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
        setNextCursor(data?.nextCursor ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/recipes?limit=60&cursor=${nextCursor}`);
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      setRecipes((prev) => [
        ...prev,
        ...(Array.isArray(data?.recipes) ? data.recipes : []),
      ]);
      setNextCursor(data?.nextCursor ?? null);
    } catch {
      /* keep what we have; silent */
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? recipes.filter((r) =>
          [r.title, r.user?.nickname, r.description ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : recipes;

    const sorted = [...list];
    if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [recipes, query, sort]);

  const searching = query.trim().length > 0;

  return (
    <main className="pb-16">
      {/* Hero — search first */}
      <section className="relative overflow-hidden bg-mist border-b border-line">
        {/* decorative blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-grass-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-citrus-300/30 blur-3xl"
        />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-10 sm:pt-20 sm:pb-14">
          <div className="max-w-2xl animate-[rise_0.5s_ease-out]">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-grass-600">
              Community Kitchen
            </p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-ink leading-[1.1]">
              오늘, 뭐<br className="sm:hidden" /> 만들어 볼까요?
            </h1>
            <p className="mt-3 text-sm sm:text-base text-ink-soft">
              셰프들이 나눈 레시피를 검색하고, 마음에 드는 한 끼를 찾아보세요.
            </p>

            {/* Search */}
            <div className="mt-6 relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-faint"
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
                placeholder="레시피, 재료, 셰프 이름으로 검색"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-line text-base
                           shadow-sm placeholder:text-ink-faint
                           focus:outline-none focus:ring-2 focus:ring-grass-400 focus:border-grass-400
                           transition-all"
              />
            </div>

            {/* Popular searches */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-faint mr-1">인기 검색</span>
              {POPULAR.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className={`chip ${query === term ? "chip-active" : ""}`}
                >
                  #{term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between gap-3 py-5 sm:py-6">
          <h2 className="text-sm sm:text-base font-bold text-ink">
            {searching ? (
              <>
                <span className="text-grass-600">‘{query.trim()}’</span> 검색 결과{" "}
                <span className="text-ink-faint font-medium">{filtered.length}</span>
              </>
            ) : (
              <>
                전체 레시피{" "}
                <span className="text-ink-faint font-medium">{filtered.length}</span>
              </>
            )}
          </h2>

          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  sort === s.key
                    ? "bg-grass-500 text-white"
                    : "text-ink-soft hover:text-grass-700"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid / states */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line overflow-hidden">
                <div className="aspect-[4/3] bg-mist animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-mist animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-mist animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            emoji="🥕"
            title="레시피를 불러오지 못했어요"
            desc="일시적인 오류일 수 있어요. 잠시 후 다시 시도해주세요."
          />
        ) : filtered.length === 0 ? (
          searching ? (
            <EmptyState
              emoji="🔍"
              title="검색 결과가 없어요"
              desc={`‘${query.trim()}’에 맞는 레시피를 찾지 못했어요.`}
              action={
                <button onClick={() => setQuery("")} className="btn-secondary mt-5">
                  전체 레시피 보기
                </button>
              }
            />
          ) : (
            <EmptyState
              emoji="🍳"
              title="아직 레시피가 없어요"
              desc="첫 번째 레시피를 올려 커뮤니티를 시작해보세요."
              action={
                user ? (
                  <Link href="/recipes/new" className="btn-primary mt-5">
                    레시피 등록하기
                  </Link>
                ) : (
                  <Link href="/login" className="btn-primary mt-5">
                    로그인하고 시작하기
                  </Link>
                )
              }
            />
          )
        ) : (
          <>
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

            {!searching && nextCursor && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn-secondary"
                >
                  {loadingMore ? "불러오는 중…" : "더 보기"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
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
