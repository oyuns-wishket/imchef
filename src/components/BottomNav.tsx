"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Heart, PaperPlane, Person } from "@/components/icons";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const profileHref = user ? "/my-recipes" : "/login";
  const isHome = pathname === "/";
  const isProfile = pathname === "/my-recipes" || pathname === "/login";

  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)]"
    >
      <div className="glass-bar rounded-full flex items-center justify-around px-3 py-2.5">
        <Link
          href="/"
          aria-label="탐색"
          aria-current={isHome ? "page" : undefined}
          className={`grid place-items-center w-11 h-11 rounded-full transition-colors ${
            isHome ? "text-ink" : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          <Search className="w-[22px] h-[22px]" />
        </Link>

        {/* 좋아요/알림 — 기능 추가 예정 (백엔드 필요) */}
        <button
          type="button"
          aria-label="좋아요 (준비 중)"
          className="grid place-items-center w-11 h-11 rounded-full text-ink-faint hover:text-ink-soft transition-colors"
        >
          <Heart className="w-[22px] h-[22px]" />
        </button>

        {/* 공유/메시지 — 기능 추가 예정 */}
        <button
          type="button"
          aria-label="공유 (준비 중)"
          className="grid place-items-center w-11 h-11 rounded-full text-ink-faint hover:text-ink-soft transition-colors"
        >
          <PaperPlane className="w-[22px] h-[22px]" />
        </button>

        <Link
          href={profileHref}
          aria-label="프로필"
          aria-current={isProfile ? "page" : undefined}
          className={`grid place-items-center w-11 h-11 rounded-full transition-colors ${
            isProfile ? "text-ink" : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          <Person className="w-[22px] h-[22px]" />
        </Link>
      </div>
    </nav>
  );
}
