"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import PasswordModal from "@/components/PasswordModal";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  user: { id: string; nickname: string };
  ingredients: { id: string; name: string; amount: string; unit: string }[];
  steps: { id: string; content: string; order: number }[];
  images: { id: string; url: string; order: number }[];
  createdAt: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default function RecipeDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then(setRecipe);

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user));
  }, [id]);

  if (!recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="text-stone-400 text-sm">불러오는 중...</div>
      </main>
    );
  }

  const isOwner = currentUser?.id === recipe.user.id;

  async function handleDelete() {
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Images */}
      {recipe.images.length > 0 && (
        <div className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-stone-100 mb-6 sm:mb-8">
          <Image
            src={recipe.images[imageIndex].url}
            alt={recipe.title}
            fill
            className="object-cover"
          />
          {recipe.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {recipe.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === imageIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900">{recipe.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-stone-400">
          <span>{recipe.user.nickname}</span>
          <span>{new Date(recipe.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {recipe.description && (
          <p className="mt-4 text-stone-600 text-sm leading-relaxed">
            {recipe.description}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 sm:gap-6 py-4 border-y border-stone-100 mb-6 sm:mb-8 text-sm">
        <div>
          <span className="text-stone-400">인분</span>
          <p className="font-medium text-stone-800">{recipe.servings}인분</p>
        </div>
        {recipe.cookTime && (
          <div>
            <span className="text-stone-400">조리시간</span>
            <p className="font-medium text-stone-800">{recipe.cookTime}분</p>
          </div>
        )}
        <div>
          <span className="text-stone-400">난이도</span>
          <p className="font-medium text-stone-800">
            {DIFFICULTY_LABELS[recipe.difficulty] || recipe.difficulty}
          </p>
        </div>
      </div>

      {/* Ingredients */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          재료
        </h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex justify-between py-2 border-b border-stone-50 text-sm"
            >
              <span className="text-stone-700">{ing.name}</span>
              <span className="text-stone-400">
                {ing.amount} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          조리 순서
        </h2>
        <ol className="space-y-6">
          {recipe.steps.map((step) => (
            <li key={step.id} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-800 text-white text-xs font-medium flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <p className="text-sm text-stone-700 leading-relaxed pt-1">
                {step.content}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-stone-100">
          <button
            onClick={() => setModal("edit")}
            className="btn-secondary"
          >
            수정
          </button>
          <button
            onClick={() => setModal("delete")}
            className="btn-danger"
          >
            삭제
          </button>
        </div>
      )}

      {/* Password Modal */}
      {modal && (
        <PasswordModal
          action={modal}
          onCancel={() => setModal(null)}
          onConfirm={() => {
            if (modal === "delete") {
              handleDelete();
            } else {
              router.push(`/recipes/${id}/edit`);
            }
          }}
        />
      )}
    </main>
  );
}
