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
    <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-stone-900 tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          imchef
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/recipes/new"
                className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                새 레시피
              </Link>
              <Link
                href="/my-recipes"
                className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                내 레시피
              </Link>
              <span className="text-sm text-stone-400">{user.nickname}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              로그인
            </Link>
          )}
        </nav>

        {/* Mobile hamburger button */}
        <button
          className="sm:hidden p-2 -mr-2 text-stone-600"
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
        <div className="sm:hidden border-t border-stone-100 bg-stone-50/95 backdrop-blur-md animate-[slide-down_0.2s_ease-out]">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link
                  href="/recipes/new"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 active:bg-stone-200 rounded-lg transition-colors"
                >
                  새 레시피
                </Link>
                <Link
                  href="/my-recipes"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 active:bg-stone-200 rounded-lg transition-colors"
                >
                  내 레시피
                </Link>
                <div className="border-t border-stone-100 mt-1 pt-1">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm text-stone-400">{user.nickname}</span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
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
                className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
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
