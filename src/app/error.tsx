"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-lg font-bold text-stone-900">
        문제가 발생했습니다
      </h1>
      <p className="mt-2 text-sm text-stone-400">
        일시적인 오류로 화면을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700"
      >
        다시 시도
      </button>
    </main>
  );
}
