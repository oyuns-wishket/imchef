import Link from "next/link";
import Image from "next/image";

interface Props {
  id: string;
  title: string;
  nickname: string;
  cookTime: number | null;
  difficulty: string;
  imageUrl: string | null;
  createdAt: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-grass-50 text-grass-700",
  normal: "bg-citrus-200/60 text-citrus-500",
  hard: "bg-red-50 text-red-500",
};

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export default function RecipeCard({
  id,
  title,
  nickname,
  cookTime,
  difficulty,
  imageUrl,
  createdAt,
}: Props) {
  const since = relativeDate(createdAt);

  return (
    <Link href={`/recipes/${id}`} className="card group block">
      <div className="relative aspect-[4/3] bg-mist">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-grass-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <span
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            DIFFICULTY_STYLES[difficulty] || "bg-white/90 text-ink-soft"
          }`}
        >
          {DIFFICULTY_LABELS[difficulty] || difficulty}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-bold text-ink text-sm sm:text-[15px] leading-snug group-hover:text-grass-600 transition-colors line-clamp-1">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-ink-faint">
          <span className="text-ink-soft font-medium">{nickname}</span>
          {cookTime ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                </svg>
                {cookTime}분
              </span>
            </>
          ) : null}
          {since ? (
            <>
              <span aria-hidden>·</span>
              <span>{since}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
