import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Cutlery — fork (left) + spoon (right) vertical pair — the imchef brand mark */
export function Logo(props: P) {
  return (
    <svg {...base} {...props}>
      {/* Fork */}
      <line x1="8" y1="20" x2="8" y2="13" />
      <path d="M8 13 C8 11.5 6.5 11 6 9.5 L6 4" />
      <line x1="8" y1="4" x2="8" y2="9" />
      <line x1="10" y1="4" x2="10" y2="9" />
      <path d="M10 9 C10 11 8 11.5 8 13" />
      {/* Spoon */}
      <line x1="16" y1="20" x2="16" y2="12" />
      <ellipse cx="16" cy="8.5" rx="3" ry="4" />
    </svg>
  );
}

/** @deprecated Use Logo instead. Kept for backward compatibility. */
export const Ladle = Logo;

export function Heart({ filled, ...props }: P & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function PaperPlane(props: P) {
  return (
    <svg {...base} {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function Comment(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function Search(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function Person(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function Clock(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export function Users(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function Gauge(props: P) {
  return (
    <svg {...base} {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function ImageOff(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function Pencil(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function LinkIcon(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function Sparkle(props: P) {
  return (
    <svg {...base} strokeWidth={1.5} fill="currentColor" stroke="none" {...props}>
      {/* 4-point sparkle: vertical diamond + horizontal diamond overlaid */}
      <path d="M12 2 C12 2 11.1 7.6 9.2 9.2 C7.3 10.8 2 12 2 12 C2 12 7.3 13.2 9.2 14.8 C11.1 16.4 12 22 12 22 C12 22 12.9 16.4 14.8 14.8 C16.7 13.2 22 12 22 12 C22 12 16.7 10.8 14.8 9.2 C12.9 7.6 12 2 12 2 Z" />
    </svg>
  );
}

export function Check(props: P) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
