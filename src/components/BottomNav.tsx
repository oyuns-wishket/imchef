"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { Search, Heart, PaperPlane, Person } from "@/components/icons";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { open: searchOpen, toggle: toggleSearch, setOpen: setSearchOpen, query, setQuery } = useSearch();

  const profileHref = user ? "/my-recipes" : "/login";
  const isHome = pathname === "/";
  const isProfile = pathname === "/my-recipes" || pathname === "/login";

  // Refs for morph container and input
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      // Small delay to let the transition start before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  // External tap detection via pointerdown on document
  useEffect(() => {
    if (!searchOpen) return;

    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen, setSearchOpen]);

  function onSearch() {
    if (isHome) {
      toggleSearch();
    } else {
      router.push("/");
      setSearchOpen(true);
    }
  }

  function onClose() {
    setSearchOpen(false);
    // Focus the search button after closing
    setTimeout(() => searchBtnRef.current?.focus(), 0);
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Only close if the new focus target is outside our container
    const relatedTarget = e.relatedTarget as Node | null;
    if (containerRef.current && relatedTarget && containerRef.current.contains(relatedTarget)) {
      return;
    }
    // If focus moves outside the container entirely, close
    if (!relatedTarget || (containerRef.current && !containerRef.current.contains(relatedTarget))) {
      // Use a small delay so pointerdown on internal elements (clear button) can run first
      // and prevent a race between blur and pointerdown on the clear button
      setTimeout(() => {
        // Re-check: if input is still not focused and container doesn't have focus, close
        if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
          setSearchOpen(false);
        }
      }, 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)]"
    >
      <div
        ref={containerRef}
        className="glass-bar rounded-full overflow-hidden"
      >
        {/* Button mode */}
        <div
          aria-hidden={searchOpen}
          className={`flex items-center justify-around px-3 py-2.5 transition-all duration-200 motion-reduce:transition-none ${
            searchOpen
              ? "opacity-0 scale-95 pointer-events-none absolute inset-0"
              : "opacity-100 scale-100"
          }`}
        >
          <button
            ref={searchBtnRef}
            type="button"
            onClick={onSearch}
            aria-label="검색"
            aria-expanded={searchOpen}
            tabIndex={searchOpen ? -1 : 0}
            className="grid place-items-center w-11 h-11 rounded-full transition-colors text-ink-faint hover:text-ink-soft"
          >
            <Search className="w-[22px] h-[22px]" />
          </button>

          {/* 좋아요/알림 — 기능 추가 예정 (백엔드 필요) */}
          <button
            type="button"
            aria-label="좋아요 (준비 중)"
            tabIndex={searchOpen ? -1 : 0}
            className="grid place-items-center w-11 h-11 rounded-full text-ink-faint hover:text-ink-soft transition-colors"
          >
            <Heart className="w-[22px] h-[22px]" />
          </button>

          {/* 공유/메시지 — 기능 추가 예정 */}
          <button
            type="button"
            aria-label="공유 (준비 중)"
            tabIndex={searchOpen ? -1 : 0}
            className="grid place-items-center w-11 h-11 rounded-full text-ink-faint hover:text-ink-soft transition-colors"
          >
            <PaperPlane className="w-[22px] h-[22px]" />
          </button>

          <Link
            href={profileHref}
            aria-label="프로필"
            aria-current={isProfile ? "page" : undefined}
            tabIndex={searchOpen ? -1 : 0}
            className={`grid place-items-center w-11 h-11 rounded-full transition-colors ${
              isProfile ? "text-ink" : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            <Person className="w-[22px] h-[22px]" />
          </Link>
        </div>

        {/* Search mode */}
        <div
          role="search"
          aria-hidden={!searchOpen}
          className={`flex items-center gap-2 px-4 py-2.5 transition-all duration-200 motion-reduce:transition-none ${
            searchOpen
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none absolute inset-0"
          }`}
        >
          <Search
            className="w-4 h-4 text-ink-faint flex-shrink-0"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="레시피, 재료, 셰프 검색"
            aria-label="레시피, 재료, 셰프 검색"
            tabIndex={searchOpen ? 0 : -1}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-base text-ink placeholder:text-ink-faint"
          />
          {/* Clear button — always present but invisible when query is empty for stable layout */}
          <button
            type="button"
            onClick={handleClear}
            aria-label="검색어 지우기"
            tabIndex={searchOpen ? 0 : -1}
            className={`grid place-items-center w-7 h-7 rounded-full flex-shrink-0 text-ink-faint hover:text-ink-soft transition-all duration-150 ${
              query.length > 0 ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[14px] h-[14px]"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="검색 닫기"
            tabIndex={searchOpen ? 0 : -1}
            className="grid place-items-center w-8 h-8 rounded-full flex-shrink-0 text-ink-faint hover:text-ink-soft transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[18px] h-[18px]"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
