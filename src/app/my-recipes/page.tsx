"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FeedPost from "@/components/FeedPost";
import { useAuth } from "@/contexts/AuthContext";
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

  return (
    <main className="max-w-[520px] mx-auto pt-5">
      {/* Profile header */}
      <div className="px-4 mb-5">
        <div className="glass rounded-3xl px-5 py-5 flex items-center justify-between">
          <div>
            <p className="text-[18px] font-bold text-ink tracking-tight">
              {user?.nickname ?? "내 프로필"}
            </p>
            <p className="text-xs text-ink-faint mt-0.5">
              레시피 {recipes.length}개
            </p>
          </div>
          <Link href="/recipes/new" className="btn-primary text-xs">
            + 등록
          </Link>
        </div>
      </div>

      {recipes.length > 0 && (
        <div className="px-3 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="내 레시피 검색"
              className="input-field pl-11 rounded-full"
            />
          </div>
        </div>
      )}

      {authLoading || loading ? (
        <div className="px-3">
          <div className="aspect-square rounded-[20px] glass animate-pulse" />
        </div>
      ) : error ? (
        <EmptyState emoji="🥕" title="불러오지 못했어요" desc="잠시 후 다시 시도해주세요." />
      ) : recipes.length === 0 ? (
        <EmptyState
          emoji="🍳"
          title="아직 등록한 레시피가 없어요"
          desc="첫 레시피를 등록해보세요."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="검색 결과가 없어요"
          desc={`‘${query.trim()}’에 맞는 레시피가 없어요.`}
        />
      ) : (
        filtered.map((r, i) => (
          <FeedPost
            key={r.id}
            id={r.id}
            title={r.title}
            nickname={r.user?.nickname ?? user?.nickname ?? "나"}
            imageUrl={r.images[0]?.url || null}
            likeCount={r.likeCount}
            commentCount={r.commentCount}
            likedByMe={r.likedByMe}
            priority={i === 0}
          />
        ))
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
    <div className="flex flex-col items-center text-center py-20 px-6">
      <div className="text-4xl mb-4" aria-hidden>
        {emoji}
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft max-w-xs">{desc}</p>
    </div>
  );
}
