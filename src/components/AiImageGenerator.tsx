"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Spinner from "@/components/ui/Spinner";
import Skeleton from "@/components/ui/Skeleton";
import { Sparkle, Check } from "@/components/icons";

type GenStatus = "idle" | "generating" | "done" | "error";

interface Props {
  imageCount: number;
  maxImages: number;
  onSelect: (url: string) => void;
  onClose: () => void;
}

const DEFAULT_N = 2;

export default function AiImageGenerator({
  imageCount,
  maxImages,
  onSelect,
  onClose,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<GenStatus>("idle");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [expectedCount, setExpectedCount] = useState(DEFAULT_N);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const promptRef = useRef<HTMLInputElement>(null);

  // 마운트 시 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = "hidden";
    promptRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ESC 키 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || status === "generating") return;

    const n = Math.min(DEFAULT_N, maxImages - imageCount);
    if (n <= 0) return;

    setStatus("generating");
    setCandidates([]);
    setSelectedIndex(null);
    setErrorMessage(null);
    setExpectedCount(n);

    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, n }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error ||
            "AI 이미지 생성을 처리할 수 없어요. 잠시 후 다시 시도하거나 직접 업로드해주세요."
        );
        setStatus("error");
        return;
      }

      const urls: string[] = (data.images ?? []).map(
        (img: { url: string }) => img.url
      );
      setCandidates(urls);
      setStatus("done");
    } catch {
      setErrorMessage("네트워크 상태를 확인하고 다시 시도해주세요.");
      setStatus("error");
    }
  }, [prompt, status, imageCount, maxImages]);

  function handleSelect(index: number) {
    setSelectedIndex((prev) => (prev === index ? null : index));
  }

  function handleConfirm() {
    if (selectedIndex === null) return;
    const url = candidates[selectedIndex];
    if (!url) return;
    if (imageCount >= maxImages) {
      alert("사진은 최대 3장까지 추가할 수 있어요.");
      onClose();
      return;
    }
    onSelect(url);
    onClose();
  }

  const canGenerate = prompt.trim().length > 0 && status !== "generating";
  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";
  const isPartial =
    isGenerating && candidates.length > 0 && candidates.length < expectedCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 이미지 생성"
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* 블러 오버레이 — 클릭 시 닫기 */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(18px) saturate(1.1)",
          WebkitBackdropFilter: "blur(18px) saturate(1.1)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 바텀 시트 카드 */}
      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-[28px_28px_0_0] flex flex-col"
        style={{
          border: "1px solid var(--color-edge)",
          borderBottom: "none",
          animation: "rise 0.3s cubic-bezier(0.22, 0.68, 0, 1.2) both",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink tracking-tight">
            <Sparkle className="w-3.5 h-3.5 text-ink" />
            AI 이미지 생성
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ border: "1px solid var(--color-edge)" }}
            aria-label="닫기"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 프롬프트 입력 */}
        <div className="flex gap-2 items-start px-4 py-3">
          <input
            ref={promptRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canGenerate) generate();
            }}
            placeholder="어떤 이미지가 나왔으면 좋겠는지 입력"
            disabled={isGenerating}
            maxLength={500}
            className="flex-1 input-field py-2.5 text-sm"
            style={{ minWidth: 0 }}
          />
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="btn-primary flex items-center gap-1.5 py-2.5 px-4 text-sm whitespace-nowrap flex-shrink-0"
            style={isGenerating ? { opacity: 0.5 } : undefined}
          >
            <Sparkle className="w-3 h-3" />
            {isGenerating ? "생성 중..." : "생성"}
          </button>
        </div>

        {/* 후보 영역 — 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ minHeight: 0 }}>
          {/* idle 상태: 안내 문구 */}
          {status === "idle" && (
            <p className="text-center text-sm text-ink-faint py-8 leading-relaxed">
              프롬프트를 입력하고 생성하세요
            </p>
          )}

          {/* generating 또는 done/partial: 그리드 */}
          {(isGenerating || isDone || isPartial) && (
            <>
              <div className="grid grid-cols-2 gap-2 py-2">
                {/* 도착한 후보 이미지 */}
                {candidates.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className="relative aspect-square rounded-2xl overflow-hidden transition-transform active:scale-[0.97]"
                    style={{
                      border:
                        selectedIndex === i
                          ? "2px solid var(--color-ink)"
                          : "1.5px solid var(--color-line)",
                    }}
                    aria-label={`후보 이미지 ${i + 1}${selectedIndex === i ? " (선택됨)" : ""}`}
                    aria-pressed={selectedIndex === i}
                  >
                    <Image
                      src={url}
                      alt={`생성된 이미지 ${i + 1}`}
                      fill
                      className="object-cover"
                    />
                    {selectedIndex === i && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-ink rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                ))}

                {/* 미도착 스켈레톤 타일 */}
                {isGenerating &&
                  Array.from({
                    length: Math.max(0, expectedCount - candidates.length),
                  }).map((_, i) => (
                    <div
                      key={`skel-${i}`}
                      className="relative aspect-square rounded-2xl overflow-hidden"
                      style={{ border: "1.5px solid var(--color-line)" }}
                    >
                      <Skeleton
                        variant="block"
                        aspectRatio="1 / 1"
                        className="!rounded-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                        <Spinner size="md" label="이미지 생성 중" />
                      </div>
                    </div>
                  ))}
              </div>

              {isGenerating && (
                <p className="text-center text-xs text-ink-soft pb-2 tracking-wide">
                  이미지를 생성하는 중이에요...
                </p>
              )}
            </>
          )}

          {/* 에러 상태 */}
          {isError && (
            <div
              className="my-2 p-4 rounded-2xl flex flex-col gap-3"
              style={{
                background: "rgba(20,20,20,0.04)",
                border: "1px solid rgba(20,20,20,0.16)",
              }}
            >
              <p className="text-sm text-ink-soft leading-relaxed">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={generate}
                className="self-start text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
                style={{ border: "1px solid var(--color-edge)" }}
              >
                다시 시도
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          className="flex gap-2 px-4 pt-2.5 pb-4"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <button type="button" onClick={onClose} className="btn-secondary py-2.5 text-sm">
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIndex === null}
            className="btn-primary flex-1 py-2.5 text-sm"
          >
            이 사진 사용
          </button>
        </div>
      </div>
    </div>
  );
}
