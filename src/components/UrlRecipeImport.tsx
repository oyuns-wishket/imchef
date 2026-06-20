"use client";

import { useState, useEffect, useRef } from "react";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface ImportedRecipe {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: "easy" | "normal" | "hard";
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string }[];
  referenceUrl: string;
}

type ImportStatus = "idle" | "analyzing" | "filled" | "partial" | "error";

const STAGES = ["링크 여는 중", "콘텐츠 분석 중", "레시피 정리 중"] as const;

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function isValidUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

interface Props {
  onResult: (recipe: ImportedRecipe) => void;
}

export default function UrlRecipeImport({ onResult }: Props) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [partialNotice, setPartialNotice] = useState<string[]>([]);
  const inFlight = useRef(false);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlValid = isValidUrl(url);

  // 단계 텍스트 타이머 (analyzing 중에만)
  useEffect(() => {
    if (status === "analyzing") {
      setStageIndex(0);
      stageTimer.current = setInterval(() => {
        setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
      }, 4000);
    } else {
      if (stageTimer.current) {
        clearInterval(stageTimer.current);
        stageTimer.current = null;
      }
    }
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [status]);

  async function handleAnalyze() {
    if (!urlValid || inFlight.current || status === "analyzing") return;

    inFlight.current = true;
    setStatus("analyzing");
    setErrorMessage("");
    setPartialNotice([]);

    try {
      const res = await fetch("/api/ai/recipe-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data?.error ||
          (res.status === 401
            ? "로그인이 필요합니다."
            : "AI 분석에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.");
        setErrorMessage(msg);
        setStatus("error");
        return;
      }

      // 성공
      const recipe: ImportedRecipe = data.recipe;
      const meta = data.meta as {
        partial: boolean;
        missingFields: string[];
        confidence: number;
      };

      onResult(recipe);

      if (meta.partial || meta.confidence < 0.4) {
        setPartialNotice(meta.missingFields ?? []);
        setStatus("partial");
      } else {
        setStatus("filled");
      }
    } catch {
      setErrorMessage("네트워크 연결을 확인해주세요.");
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  function handleRetry() {
    setStatus("idle");
    setErrorMessage("");
    setPartialNotice([]);
  }

  const isAnalyzing = status === "analyzing";

  return (
    <div className="url-import-root">
      {/* ── URL 입력 박스 ── */}
      <div className="url-import-box">
        <div className="url-import-label">AI 자동생성</div>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAnalyze();
            }
          }}
          placeholder="영상/블로그 링크를 붙여넣어 주세요"
          className="input-field url-import-input"
          disabled={isAnalyzing}
          aria-label="레시피 URL 입력"
          autoComplete="off"
        />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!urlValid || isAnalyzing}
          className="url-import-btn btn-primary"
          aria-busy={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <span className="url-import-btn-spinner" aria-hidden="true" />
              분석 중...
            </>
          ) : (
            <>
              <SparkleIcon />
              링크 등록하고 AI 레시피 자동생성
            </>
          )}
        </button>
      </div>

      {/* ── 시안 2: 스캔라인 Sweep 로더 ── */}
      {isAnalyzing && (
        <div className="v2-loader" role="status" aria-live="polite">
          {/* 썸네일 영역 + 스캔 빔 */}
          <div className="v2-thumb" aria-hidden="true">
            <div className="v2-grid" />
            <div className="v2-scan" />
            <span className="v2-thumb-label">콘텐츠 분석 중</span>
          </div>

          {/* 정보 영역 */}
          <div className="v2-info">
            <div className="v2-url-chip">
              <span className="v2-url-dot" aria-hidden="true" />
              <span className="v2-url-text">{url.trim().replace(/^https?:\/\//, "")}</span>
            </div>
            <p className="v2-status">{STAGES[stageIndex]}</p>
            <p className="v2-sub">AI가 링크를 열어 레시피 정보를 읽고 있어요</p>
            {/* 2px 프로그레스 바 */}
            <div className="v2-bar-track" aria-hidden="true">
              <div className="v2-bar-fill" />
            </div>
          </div>
        </div>
      )}

      {/* ── 완료 배너 ── */}
      {status === "filled" && (
        <div className="url-import-done-banner" role="status">
          <CheckIcon />
          AI가 자동으로 채웠어요 — 자유롭게 수정하세요
        </div>
      )}

      {/* ── 부분 추출 안내 ── */}
      {status === "partial" && (
        <div className="url-import-partial-notice" role="status">
          <InfoIcon />
          <div>
            <p className="url-import-partial-head">일부만 자동 채웠어요</p>
            {partialNotice.length > 0 && (
              <p className="url-import-partial-sub">
                {partialNotice
                  .map((f) =>
                    f === "ingredients"
                      ? "재료"
                      : f === "steps"
                      ? "조리순서"
                      : f
                  )
                  .join(", ")}{" "}
                항목을 직접 입력해주세요
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="url-import-retry-btn"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* ── 에러 안내 ── */}
      {status === "error" && (
        <div className="url-import-error-notice" role="alert">
          <InfoIcon />
          <div className="url-import-error-msg">{errorMessage}</div>
          <button
            type="button"
            onClick={handleRetry}
            className="url-import-retry-btn"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 아이콘 ───────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
