"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Ladle, Pencil, Person } from "@/components/icons";

export default function Header() {
  const router = useRouter();
  const { user, clearUser } = useAuth();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUser();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 glass-bar">
      <div className="max-w-[520px] mx-auto px-4 h-[60px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-ink" aria-label="홈">
          <Ladle className="w-[26px] h-[26px]" strokeWidth={1.5} />
          <span className="text-[18px] font-semibold tracking-tight">
            Im<span style={{ color: "var(--color-accent)" }}>chef</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/recipes/new"
                aria-label="레시피 등록"
                className="grid place-items-center w-9 h-9 rounded-full text-ink-soft hover:text-ink hover:bg-white/50 transition-colors"
              >
                <Pencil className="w-[18px] h-[18px]" />
              </Link>
              <Link
                href="/my-recipes"
                aria-label="내 프로필"
                className="grid place-items-center w-9 h-9 rounded-full text-ink-soft hover:text-ink hover:bg-white/50 transition-colors"
              >
                <Person className="w-[18px] h-[18px]" />
              </Link>
              <button
                onClick={handleLogout}
                className="ml-1 text-xs text-ink-faint hover:text-ink-soft transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
