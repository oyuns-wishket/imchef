"use client";

import { useEffect, useMemo, useState } from "react";
import FeedPost from "@/components/FeedPost";
import { useSearch } from "@/contexts/SearchContext";
import Spinner from "@/components/ui/Spinner";
import Skeleton from "@/components/ui/Skeleton";

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
  const { open: searchOpen, query, setQuery } = useSearch();

  // Clear the query when search closes.
  useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen, setQuery]);

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
      {loading ? (
        <div role="status" aria-busy="true" aria-label="불러오는 중" className="px-3 space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton variant="block" aspectRatio="1 / 1" className="rounded-[20px]" />
              <div className="mt-3">
                <Skeleton variant="line" width="66%" height={14} />
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
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary inline-flex items-center gap-2">
                {loadingMore ? (
                  <>
                    <Spinner size="sm" label="불러오는 중" />
                    불러오는 중…
                  </>
                ) : (
                  "더 보기"
                )}
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
