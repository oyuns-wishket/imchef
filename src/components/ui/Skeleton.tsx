"use client";

export type SkeletonVariant = "line" | "block" | "circle";

export interface SkeletonProps {
  /** 모양. line=텍스트 자리, block=이미지/카드 자리, circle=아바타. 기본 "line". */
  variant?: SkeletonVariant;
  /** CSS width (예: "100%", "66%", 240). variant=circle이면 지름. */
  width?: string | number;
  /** CSS height (예: 14, "1rem"). block은 aspectRatio와 병용 가능. */
  height?: string | number;
  /** 동일 스켈레톤 반복 개수(목록 자리). 기본 1. >1이면 세로 stack 렌더. */
  count?: number;
  /** block 변형의 종횡비(예: "1 / 1", "4 / 3"). CLS 방지용. */
  aspectRatio?: string;
  /** 추가 클래스 (둥근 정도 오버라이드 등). */
  className?: string;
}

function cssVal(v: string | number | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return `${v}px`;
  return v;
}

function SkeletonItem({
  variant = "line",
  width,
  height,
  aspectRatio,
  className = "",
}: Omit<SkeletonProps, "count">) {
  const base = "skeleton-item animate-pulse bg-white/50";

  const shapeClass =
    variant === "circle"
      ? "rounded-full"
      : variant === "block"
      ? "rounded-[20px]"
      : "rounded";

  const style: React.CSSProperties = {
    width: cssVal(width) ?? (variant === "circle" ? undefined : "100%"),
    height:
      variant === "circle"
        ? cssVal(width) // 지름 = 너비
        : cssVal(height) ?? (variant === "line" ? "14px" : undefined),
    aspectRatio: variant !== "circle" ? aspectRatio : undefined,
    border: "1px solid var(--color-line)",
    backgroundColor: "rgba(255,255,255,0.5)",
    display: "block",
  };

  if (variant === "circle" && width) {
    style.width = cssVal(width);
    style.height = cssVal(width);
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} ${shapeClass} ${className}`}
      style={style}
    />
  );
}

export default function Skeleton({
  variant = "line",
  width,
  height,
  count = 1,
  aspectRatio,
  className = "",
}: SkeletonProps) {
  const safeCount = Math.max(1, Math.floor(count ?? 1));

  if (safeCount === 1) {
    return (
      <SkeletonItem
        variant={variant}
        width={width}
        height={height}
        aspectRatio={aspectRatio}
        className={className}
      />
    );
  }

  return (
    <span
      role="status"
      aria-busy="true"
      aria-label="불러오는 중"
      className="flex flex-col gap-2"
    >
      {Array.from({ length: safeCount }).map((_, i) => (
        <SkeletonItem
          key={i}
          variant={variant}
          width={width}
          height={height}
          aspectRatio={aspectRatio}
          className={className}
        />
      ))}
    </span>
  );
}
