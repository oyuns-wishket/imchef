"use client";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  /** 외경 프리셋. sm=16px, md=24px, lg=40px. 기본 "md". */
  size?: SpinnerSize;
  /** ring 두께(px). 미지정 시 size별 기본값(sm=2, md=2.5, lg=3). */
  strokeWidth?: number;
  /** 스크린리더용 라벨(sr-only로 렌더). 기본 "불러오는 중". */
  label?: string;
  /** 위치/마진 조정용 클래스 (색 새 팔레트 금지). */
  className?: string;
}

const SIZE_MAP: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 40,
};

const STROKE_MAP: Record<SpinnerSize, number> = {
  sm: 2,
  md: 2.5,
  lg: 3,
};

export default function Spinner({
  size = "md",
  strokeWidth,
  label = "불러오는 중",
  className = "",
}: SpinnerProps) {
  const diameter = SIZE_MAP[size] ?? SIZE_MAP.md;
  const sw = (strokeWidth != null && strokeWidth > 0) ? strokeWidth : STROKE_MAP[size];
  const r = (diameter - sw) / 2;
  const cx = diameter / 2;
  const circumference = 2 * Math.PI * r;
  // 진행 호: circumference의 약 25% (1/4 회전)
  const dash = circumference * 0.25;
  const gap = circumference - dash;

  return (
    <span
      role="status"
      aria-busy="true"
      aria-label={label || "불러오는 중"}
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: diameter, height: diameter }}
    >
      {/* SVG 자체는 데코레이션 — 라벨은 sr-only span이 담당 */}
      <svg
        aria-hidden="true"
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        fill="none"
        className="spinner-svg"
        style={{ display: "block" }}
      >
        {/* 트랙 (전체 원) */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="var(--color-line)"
          strokeWidth={sw}
          strokeLinecap="round"
        />
        {/* 진행 호 */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="var(--color-ink)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={0}
          className="spinner-arc"
        />
      </svg>
      <span className="sr-only">{label || "불러오는 중"}</span>
    </span>
  );
}
