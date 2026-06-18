"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const router = useRouter();
  const { user, clearUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUser();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-md border-b border-line">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-xl font-extrabold text-ink tracking-tight flex items-center gap-1.5"
          onClick={() => setMenuOpen(false)}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-grass-500"
            aria-hidden
          />
          imchef
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/my-recipes"
                className="px-3 py-2 text-sm font-medium text-ink-soft hover:text-grass-700 transition-colors"
              >
                내 레시피
              </Link>
              <Link href="/recipes/new" className="btn-primary text-xs">
                + 레시피 등록
              </Link>
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-line">
                <span className="text-sm font-medium text-ink-soft">
                  {user.nickname}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-ink-faint hover:text-ink-soft transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              로그인
            </Link>
          )}
        </nav>

        {/* Mobile hamburger button */}
        <button
          className="sm:hidden p-2 -mr-2 text-ink-soft"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴"
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-line bg-canvas/95 backdrop-blur-md animate-[slide-down_0.2s_ease-out]">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link
                  href="/recipes/new"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-semibold text-grass-700 hover:bg-grass-50 rounded-lg transition-colors"
                >
                  + 레시피 등록
                </Link>
                <Link
                  href="/my-recipes"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-grass-50 rounded-lg transition-colors"
                >
                  내 레시피
                </Link>
                <div className="border-t border-line mt-1 pt-1">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm font-medium text-ink-soft">{user.nickname}</span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-ink-faint hover:text-ink-soft transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-grass-50 rounded-lg"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
