import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  const recipes = await prisma.recipe.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: { select: { nickname: true } },
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { ingredients: true, steps: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, servings, cookTime, difficulty, ingredients, steps, imageUrls } = body;

  if (!title || !ingredients?.length || !steps?.length) {
    return NextResponse.json(
      { error: "제목, 재료, 조리 순서는 필수입니다." },
      { status: 400 }
    );
  }

  const recipe = await prisma.recipe.create({
    data: {
      title,
      description: description || null,
      servings: servings || 1,
      cookTime: cookTime || null,
      difficulty: difficulty || "normal",
      userId: session.userId,
      ingredients: {
        create: ingredients.map(
          (ing: { name: string; amount: string; unit: string }, i: number) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            order: i,
          })
        ),
      },
      steps: {
        create: steps.map(
          (step: { content: string }, i: number) => ({
            content: step.content,
            order: i + 1,
          })
        ),
      },
      images: {
        create: (imageUrls || []).map((url: string, i: number) => ({
          url,
          order: i,
        })),
      },
    },
    include: {
      ingredients: true,
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(recipe, { status: 201 });
}
