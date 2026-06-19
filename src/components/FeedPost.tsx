"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, PaperPlane, Comment, ImageOff } from "@/components/icons";

interface Props {
  id: string;
  title: string;
  nickname: string;
  imageUrl: string | null;
  priority?: boolean;
}

export default function FeedPost({ id, title, nickname, imageUrl, priority }: Props) {
  // Like is a local visual toggle for now — persisting it needs a likes table.
  const [liked, setLiked] = useState(false);

  async function share() {
    const url = `${window.location.origin}/recipes/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("링크를 복사했어요!");
      }
    } catch {
      /* user cancelled share — ignore */
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
          onClick={() => setLiked((v) => !v)}
          className={`fchip ${liked ? "fchip-liked" : ""}`}
        >
          <Heart
            filled={liked}
            className="w-3.5 h-3.5"
            style={liked ? { animation: "pop 0.3s ease-out" } : undefined}
          />
          좋아요
        </button>
        <button type="button" aria-label="공유" onClick={share} className="fchip">
          <PaperPlane className="w-3.5 h-3.5" />
          공유
        </button>
        <Link href={`/recipes/${id}`} aria-label="댓글" className="fchip">
          <Comment className="w-3.5 h-3.5" />
          댓글
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
