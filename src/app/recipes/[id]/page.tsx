"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PasswordModal from "@/components/PasswordModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Clock,
  Gauge,
  Heart,
  PaperPlane,
  Comment as CommentIcon,
  LinkIcon,
} from "@/components/icons";
import Skeleton from "@/components/ui/Skeleton";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  referenceUrl: string | null;
  user: { id: string; nickname: string };
  ingredients: { id: string; name: string; amount: string; unit: string }[];
  steps: { id: string; content: string; order: number }[];
  images: { id: string; url: string; order: number }[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; nickname: string };
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipes/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === "object" && data.user) {
          setRecipe(data);
          setLiked(!!data.likedByMe);
          setLikeCount(data.likeCount ?? 0);
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipes/${id}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((data) => {
        if (!cancelled) setComments(Array.isArray(data?.comments) ? data.comments : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <main className="max-w-[520px] mx-auto px-3 pt-3" role="status" aria-busy="true" aria-label="불러오는 중">
        <Skeleton variant="block" aspectRatio="4 / 3" className="rounded-3xl" />
        <div className="mt-4 space-y-2.5 px-0.5">
          <Skeleton variant="line" width="70%" height={22} />
          <Skeleton variant="line" width="40%" height={13} />
        </div>
        <div className="mt-5 space-y-2 px-0.5">
          <Skeleton variant="line" width="100%" height={13} />
          <Skeleton variant="line" width="85%" height={13} />
          <Skeleton variant="line" width="60%" height={13} />
        </div>
      </main>
    );
  }

  if (status === "error" || !recipe) {
    return (
      <main className="max-w-[520px] mx-auto px-6 py-24 text-center">
        <div className="text-4xl mb-4" aria-hidden>🍲</div>
        <p className="text-base font-bold text-ink">레시피를 불러올 수 없습니다.</p>
        <button onClick={() => router.push("/")} className="btn-secondary mt-5">
          홈으로
        </button>
      </main>
    );
  }

  const isOwner = currentUser?.id === recipe.user.id;

  async function handleDelete() {
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  async function toggleLike() {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/recipes/${id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch {
      // revert
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    } finally {
      setLikeBusy(false);
    }
  }

  async function share() {
    if (!recipe) return;
    const url = `${window.location.origin}/recipes/${recipe.id}`;
    try {
      if (navigator.share) await navigator.share({ title: recipe.title, url });
      else {
        await navigator.clipboard.writeText(url);
        alert("링크를 복사했어요!");
      }
    } catch {
      /* cancelled */
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const content = commentText.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/recipes/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setComments((prev) => [created, ...prev]);
      setCommentText("");
    } catch {
      alert("댓글 등록에 실패했어요.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="max-w-[520px] mx-auto px-3 pt-3">
      {/* Hero */}
      {recipe.images.length > 0 && (
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-[#f2f2f2] mb-5">
          <Image
            src={recipe.images[imageIndex].url}
            alt={recipe.title}
            fill
            priority
            sizes="(max-width: 520px) 100vw, 500px"
            className="object-contain"
          />
          {recipe.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {recipe.images.map((_, i) => (
                <button
                  key={i}
                  aria-label={`사진 ${i + 1}`}
                  onClick={() => setImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === imageIndex ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <h1 className="text-[22px] font-bold tracking-tight text-ink leading-tight px-0.5">
        {recipe.title}
      </h1>
      <p className="text-[13px] text-ink-faint mt-1 px-0.5">
        @{recipe.user.nickname} · {relativeDate(recipe.createdAt)}
      </p>

      {/* Like / Share */}
      <div className="flex gap-2 mt-3 px-0.5">
        <button
          type="button"
          aria-pressed={liked}
          onClick={toggleLike}
          className={`fchip ${liked ? "fchip-liked" : ""}`}
        >
          <Heart
            filled={liked}
            className="w-3.5 h-3.5"
            style={liked ? { animation: "pop 0.3s ease-out" } : undefined}
          />
          {likeCount > 0 ? likeCount : "좋아요"}
        </button>
        <button type="button" onClick={share} className="fchip">
          <PaperPlane className="w-3.5 h-3.5" />
          공유
        </button>
        <span className="fchip">
          <CommentIcon className="w-3.5 h-3.5" />
          {comments.length}
        </span>
      </div>

      {recipe.description && (
        <p className="mt-4 text-sm text-ink-soft leading-relaxed px-0.5">
          {recipe.description}
        </p>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-2 mt-4 px-0.5">
        <span className="fchip">
          <Users className="w-3.5 h-3.5" />
          <strong className="text-ink font-semibold">{recipe.servings}</strong>인분
        </span>
        {recipe.cookTime && (
          <span className="fchip">
            <Clock className="w-3.5 h-3.5" />
            <strong className="text-ink font-semibold">{recipe.cookTime}</strong>분
          </span>
        )}
        <span className="fchip">
          <Gauge className="w-3.5 h-3.5" />
          {DIFFICULTY_LABELS[recipe.difficulty] || recipe.difficulty}
        </span>
      </div>

      {/* Ingredients */}
      <section className="mt-7">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2.5 px-0.5">
          재료
        </h2>
        <ul className="glass rounded-2xl overflow-hidden">
          {recipe.ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex justify-between items-center px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: "var(--color-line)" }}
            >
              <span className="text-[13px] text-ink font-medium">{ing.name}</span>
              <span className="text-xs text-ink-faint">
                {ing.amount} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section className="mt-7">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2.5 px-0.5">
          조리 순서
        </h2>
        <ol className="space-y-2.5">
          {recipe.steps.map((step) => (
            <li key={step.id} className="glass rounded-2xl flex gap-3 p-3.5">
              <span className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-ink text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <p className="text-[13px] text-ink leading-relaxed pt-0.5">
                {step.content}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Reference link */}
      {recipe.referenceUrl && (
        <section className="mt-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2.5 px-0.5">
            참고 링크
          </h2>
          <a
            href={recipe.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-medium break-all glass text-ink hover:bg-[#fafafa] transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{recipe.referenceUrl}</span>
          </a>
        </section>
      )}

      {/* Comments */}
      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-3 px-0.5">
          댓글 {comments.length}
        </h2>

        {currentUser ? (
          <form onSubmit={addComment} className="flex gap-2 mb-4">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="따뜻한 댓글을 남겨보세요"
              maxLength={500}
              className="input-field rounded-full flex-1"
            />
            <button
              type="submit"
              disabled={posting || !commentText.trim()}
              className="btn-primary px-4"
            >
              등록
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="block glass rounded-2xl px-4 py-3 text-[13px] text-ink-soft mb-4"
          >
            로그인하고 댓글을 남겨보세요 →
          </Link>
        )}

        {comments.length === 0 ? (
          <p className="text-[13px] text-ink-faint px-0.5 py-2">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요!
          </p>
        ) : (
          <ul className="space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className="glass rounded-2xl px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    @{c.user.nickname}
                  </span>
                  <span className="text-[11px] text-ink-faint flex-shrink-0">
                    {relativeDate(c.createdAt)}
                  </span>
                </div>
                <p className="text-[13px] text-ink-soft mt-1 leading-relaxed whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex gap-3 mt-8 pt-5" style={{ borderTop: "1px solid var(--color-line)" }}>
          <button onClick={() => setModal("edit")} className="btn-secondary flex-1">
            수정
          </button>
          <button onClick={() => setModal("delete")} className="btn-danger flex-1">
            삭제
          </button>
        </div>
      )}

      {modal && (
        <PasswordModal
          action={modal}
          onCancel={() => setModal(null)}
          onConfirm={() => {
            if (modal === "delete") handleDelete();
            else router.push(`/recipes/${id}/edit`);
          }}
        />
      )}
    </main>
  );
}
