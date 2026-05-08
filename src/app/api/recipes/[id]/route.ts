import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, nickname: true, loginId: true } },
      ingredients: { orderBy: { order: "asc" } },
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }
  if (recipe.userId !== session.userId) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, servings, cookTime, difficulty, ingredients, steps, imageUrls, referenceUrl } = body;

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipeStep.deleteMany({ where: { recipeId: id } }),
    prisma.recipeImage.deleteMany({ where: { recipeId: id } }),
  ]);

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      title,
      description: description || null,
      servings: servings || 1,
      cookTime: cookTime || null,
      difficulty: difficulty || "normal",
      referenceUrl: referenceUrl || null,
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
      ingredients: { orderBy: { order: "asc" } },
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }
  if (recipe.userId !== session.userId) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.recipe.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
