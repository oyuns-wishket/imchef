"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, PaperPlane, Comment, ImageOff } from "@/components/icons";

interface Props {
  id: string;
  title: string;
  nickname: string;
  imageUrl: string | null;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
  priority?: boolean;
}

export default function FeedPost({
  id,
  title,
  nickname,
  imageUrl,
  likeCount = 0,
  commentCount = 0,
  likedByMe = false,
  priority,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/recipes/${id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked((v) => !v);
      setCount((c) => c + (liked ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/recipes/${id}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        alert("링크를 복사했어요!");
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <article className="px-3 mb-5">
      <Link href={`/recipes/${id}`} className="block">
        {imageUrl ? (
          <div className="relative aspect-square rounded-[20px] overflow-hidden bg-[#E0DDD8]">
            <Image
              src={imageUrl}
              alt={title}
              fill
              priority={priority}
              sizes="(max-width: 520px) 100vw, 500px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="glass aspect-square rounded-[20px] flex flex-col items-center justify-center gap-2.5">
            <ImageOff className="w-9 h-9 text-ink-faint" strokeWidth={1.4} />
            <span className="text-[13px] text-ink-faint">음식 사진이 없어요!</span>
          </div>
        )}
      </Link>

      <div className="flex gap-2 mt-2.5 px-0.5">
        <button
          type="button"
          aria-pressed={liked}
          aria-label="좋아요"
          onClick={toggleLike}
          className={`fchip ${liked ? "fchip-liked" : ""}`}
        >
          <Heart
            filled={liked}
            className="w-3.5 h-3.5"
            style={liked ? { animation: "pop 0.3s ease-out" } : undefined}
          />
          {count > 0 ? count : "좋아요"}
        </button>
        <button type="button" aria-label="공유" onClick={share} className="fchip">
          <PaperPlane className="w-3.5 h-3.5" />
          공유
        </button>
        <Link href={`/recipes/${id}`} aria-label="댓글" className="fchip">
          <Comment className="w-3.5 h-3.5" />
          {commentCount > 0 ? commentCount : "댓글"}
        </Link>
      </div>

      <Link href={`/recipes/${id}`} className="block mt-2 px-0.5">
        <h3 className="text-[15px] font-semibold text-ink tracking-tight leading-snug line-clamp-1">
          {title}
        </h3>
        <p className="text-xs text-ink-faint mt-0.5">@{nickname}</p>
      </Link>
    </article>
  );
}
