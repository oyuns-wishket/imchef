import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { handleApiError } from "@/lib/api";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const cursor = searchParams.get("cursor");

    // Who's viewing — used to mark which posts they've already liked.
    const session = await getIronSession<SessionData>(
      await cookies(),
      sessionOptions
    );
    const viewerId = session.userId;

    const recipes = await prisma.recipe.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: { select: { nickname: true } },
        images: { orderBy: { order: "asc" }, take: 1 },
        _count: { select: { likes: true, comments: true } },
        ...(viewerId
          ? { likes: { where: { userId: viewerId }, select: { id: true } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = recipes.length > limit;
    const page = hasMore ? recipes.slice(0, limit) : recipes;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    const items = page.map((r) => {
      const { _count, likes, ...rest } = r as typeof r & {
        likes?: { id: string }[];
      };
      return {
        ...rest,
        likeCount: _count.likes,
        commentCount: _count.comments,
        likedByMe: Array.isArray(likes) && likes.length > 0,
      };
    });

    return NextResponse.json(
      { recipes: items, nextCursor },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, "GET /api/recipes");
  }
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
  const { title, description, servings, cookTime, difficulty, ingredients, steps, imageUrls, referenceUrl } = body;

  if (!title || !ingredients?.length || !steps?.length) {
    return NextResponse.json(
      { error: "제목, 재료, 조리 순서는 필수입니다." },
      { status: 400 }
    );
  }

  try {
  const recipe = await prisma.recipe.create({
    data: {
      title,
      description: description || null,
      servings: servings || 1,
      cookTime: cookTime || null,
      difficulty: difficulty || "normal",
      referenceUrl: referenceUrl || null,
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
  } catch (error) {
    return handleApiError(error, "POST /api/recipes");
  }
}
