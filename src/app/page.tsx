"use client";

import { useEffect, useMemo, useState } from "react";
import FeedPost from "@/components/FeedPost";
import { Search } from "@/components/icons";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  user: { nickname: string };
  images: { url: string }[];
  createdAt: string;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/recipes?limit=30")
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
      const r = await fetch(`/api/recipes?limit=30&cursor=${nextCursor}`);
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      setRecipes((prev) => [
        ...prev,
        ...(Array.isArray(data?.recipes) ? data.recipes : []),
      ]);
      setNextCursor(data?.nextCursor ?? null);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) =>
      [r.title, r.user?.nickname, r.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [recipes, query]);

  const searching = query.trim().length > 0;

  return (
    <main className="max-w-[520px] mx-auto pt-3">
      {/* Slim frosted search */}
      <div className="px-3 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="레시피, 재료, 셰프 검색"
            className="input-field pl-11 rounded-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="px-3 space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-[20px] glass animate-pulse" />
              <div className="h-3.5 w-2/3 rounded bg-white/50 animate-pulse mt-3" />
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
          />
        ) : (
          <EmptyState
            emoji="🍳"
            title="아직 레시피가 없어요"
            desc="첫 번째 레시피를 올려 커뮤니티를 시작해보세요."
          />
        )
      ) : (
        <>
          {filtered.map((r, i) => (
            <FeedPost
              key={r.id}
              id={r.id}
              title={r.title}
              nickname={r.user?.nickname ?? "익명"}
              imageUrl={r.images[0]?.url || null}
              likeCount={r.likeCount}
              commentCount={r.commentCount}
              likedByMe={r.likedByMe}
              priority={i === 0}
            />
          ))}

          {!searching && nextCursor && (
            <div className="flex justify-center mt-2 mb-4">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                {loadingMore ? "불러오는 중…" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function EmptyState({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-24 px-6">
      <div className="text-4xl mb-4" aria-hidden>
        {emoji}
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft max-w-xs">{desc}</p>
    </div>
  );
}
