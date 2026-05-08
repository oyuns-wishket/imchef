"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  id: string;
  loginId: string;
  nickname: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-stone-900 tracking-tight"
        >
          imchef
        </Link>

        <nav className="flex items-center gap-3">
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
      </div>
    </header>
  );
}
