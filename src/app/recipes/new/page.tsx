"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecipeForm from "@/components/RecipeForm";

export default function NewRecipePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.push("/login");
        else setAuthorized(true);
      });
  }, [router]);

  if (!authorized) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-stone-900 mb-8">새 레시피</h1>
      <RecipeForm />
    </main>
  );
}
