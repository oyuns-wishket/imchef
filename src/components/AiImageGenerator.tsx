"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Spinner from "@/components/ui/Spinner";
import Skeleton from "@/components/ui/Skeleton";
import { Sparkle, Check } from "@/components/icons";
import { useOverlayActive } from "@/contexts/OverlayContext";

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
  // 오버레이 활성 — 하단 BottomNav 숨김
  useOverlayActive();

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
    >
      {/* 풀스크린 블러 백드롭 — 클릭 시 닫기 */}
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

      {/* 바텀 시트 — 시안 1 .glass-card */}
      <div
        className="relative z-10 w-full max-w-lg bg-white flex flex-col"
        style={{
          borderRadius: "28px 28px 0 0",
          border: "1px solid var(--color-edge)",
          borderBottom: "none",
          animation: "rise 0.3s cubic-bezier(0.22, 0.68, 0, 1.2) both",
          maxHeight: "85vh",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 — panel-header: padding 18px 20px 14px */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--color-line)",
            flexShrink: 0,
          }}
        >
          <span
            className="flex items-center text-ink font-bold"
            style={{ fontSize: "15px", letterSpacing: "-0.02em", gap: "5px" }}
          >
            <Sparkle
              style={{ display: "inline", verticalAlign: "middle", width: 14, height: 14 }}
              aria-hidden="true"
            />
            AI 이미지 생성
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center transition-colors hover:bg-black/5"
            style={{
              width: 28,
              height: 28,
              border: "1px solid var(--color-edge)",
              borderRadius: "50%",
            }}
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

        {/* 프롬프트 행 — prompt-wrap: padding 14px 16px 10px */}
        <div
          className="flex items-start"
          style={{ padding: "14px 16px 10px", gap: 8, flexShrink: 0 }}
        >
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
            className="input-field"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              padding: "11px 14px",
            }}
          />
          {/* btn-gen — 시안 1: height 38px, pill, gap 6px */}
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="flex items-center justify-center flex-shrink-0 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "0 18px",
              height: 38,
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 600,
              background: isGenerating ? "var(--color-ink-soft)" : "var(--color-ink)",
              color: "#fff",
              border: isGenerating
                ? "1px solid var(--color-ink-soft)"
                : "1px solid var(--color-ink)",
              whiteSpace: "nowrap",
            }}
          >
            <Sparkle style={{ width: 12, height: 12 }} aria-hidden="true" />
            <span>{isGenerating ? "생성 중" : status === "done" ? "재생성" : status === "error" ? "재시도" : "생성"}</span>
          </button>
        </div>

        {/* 후보 영역 — 스크롤 가능 */}
        <div
          className="overflow-y-auto"
          style={{ flex: 1, minHeight: 0 }}
        >
          {/* idle 상태: 안내 문구 */}
          {status === "idle" && (
            <p
              className="text-center leading-relaxed"
              style={{
                fontSize: 12,
                color: "var(--color-ink-faint)",
                padding: "20px 16px",
                lineHeight: 1.7,
              }}
            >
              프롬프트를 입력하고 생성 버튼을 눌러주세요
            </p>
          )}

          {/* generating 또는 done/partial: 그리드 — cand-grid: padding 0 16px 4px */}
          {(isGenerating || isDone || isPartial) && (
            <>
              <div
                className="grid grid-cols-2"
                style={{ gap: 8, padding: "0 16px 4px" }}
              >
                {/* 도착한 후보 이미지 */}
                {candidates.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className="relative aspect-square overflow-hidden transition-transform active:scale-[0.97] hover:scale-[0.98]"
                    style={{
                      borderRadius: 14,
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
                    {/* check-badge: top 6px right 6px, 20x20, bg-ink, rounded-full */}
                    {selectedIndex === i && (
                      <span
                        className="absolute flex items-center justify-center bg-ink rounded-full"
                        style={{ top: 6, right: 6, width: 20, height: 20 }}
                      >
                        <Check
                          style={{ width: 10, height: 10, color: "#fff" }}
                        />
                      </span>
                    )}
                  </button>
                ))}

                {/* 미도착 스켈레톤 타일 — skeleton + spinner-wrap */}
                {isGenerating &&
                  Array.from({
                    length: Math.max(0, expectedCount - candidates.length),
                  }).map((_, i) => (
                    <div
                      key={`skel-${i}`}
                      className="relative aspect-square overflow-hidden"
                      style={{
                        borderRadius: 14,
                        border: "1.5px solid var(--color-line)",
                      }}
                    >
                      <Skeleton
                        variant="block"
                        aspectRatio="1 / 1"
                        className="!rounded-none"
                      />
                      {/* spinner-wrap: inset-0 flex center, bg white/50 */}
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.5)" }}
                      >
                        <Spinner size="md" label="이미지 생성 중" />
                      </div>
                    </div>
                  ))}
              </div>

              {/* progress-label: 시안 font-size 11px, color ink-soft, center, padding 6px 0 2px */}
              {isGenerating && (
                <p
                  className="text-center"
                  style={{
                    fontSize: 11,
                    color: "var(--color-ink-soft)",
                    padding: "6px 0 2px",
                    letterSpacing: "0.04em",
                  }}
                >
                  이미지를 생성하는 중이에요...
                </p>
              )}

              {isDone && selectedIndex === null && (
                <p
                  className="text-center"
                  style={{
                    fontSize: 11,
                    color: "var(--color-ink-soft)",
                    padding: "6px 0 2px",
                    letterSpacing: "0.04em",
                  }}
                >
                  마음에 드는 이미지를 선택하세요
                </p>
              )}
            </>
          )}

          {/* 에러 상태 — error-block: margin 10px 16px, padding 12px 14px, radius 14px */}
          {isError && (
            <div
              className="flex flex-col"
              style={{
                margin: "10px 16px",
                padding: "12px 14px",
                background: "rgba(20,20,20,0.04)",
                border: "1px solid rgba(20,20,20,0.16)",
                borderRadius: 14,
                gap: 8,
              }}
            >
              <p
                className="leading-snug"
                style={{
                  fontSize: 12,
                  color: "var(--color-ink-soft)",
                  lineHeight: 1.55,
                }}
              >
                {errorMessage}
              </p>
              {/* btn-retry: border 1px edge, radius 99px, font-size 12px, font-weight 600 */}
              <button
                type="button"
                onClick={generate}
                className="self-start transition-colors hover:bg-black/5"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: "none",
                  border: "1px solid var(--color-edge)",
                  borderRadius: 99,
                  padding: "5px 14px",
                  color: "var(--color-ink)",
                  cursor: "pointer",
                }}
              >
                다시 시도
              </button>
            </div>
          )}
        </div>

        {/* 푸터 — panel-footer: padding 10px 16px 16px, gap 8px */}
        <div
          className="flex"
          style={{
            gap: 8,
            padding: "10px 16px 16px",
            borderTop: "1px solid var(--color-line)",
            flexShrink: 0,
          }}
        >
          {/* 취소: flex 0 0 auto (너비 고정 pill) */}
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: "0 0 auto", height: 44, padding: "0 20px" }}
          >
            취소
          </button>
          {/* 이 사진 사용: flex 1 */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIndex === null}
            className="btn-primary"
            style={{ flex: 1, height: 44, padding: "0 20px" }}
          >
            이 사진 사용
          </button>
        </div>
      </div>
    </div>
  );
}
