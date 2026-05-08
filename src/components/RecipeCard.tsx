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

export default function RecipeCard({
  id,
  title,
  nickname,
  cookTime,
  difficulty,
  imageUrl,
  createdAt,
}: Props) {
  return (
    <Link href={`/recipes/${id}`} className="card group block">
      <div className="relative aspect-[4/3] bg-stone-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-stone-900 text-sm group-hover:text-stone-600 transition-colors line-clamp-1">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
          <span>{nickname}</span>
          <span>·</span>
          {cookTime && <><span>{cookTime}분</span><span>·</span></>}
          <span>{DIFFICULTY_LABELS[difficulty] || difficulty}</span>
        </div>
      </div>
    </Link>
  );
}
