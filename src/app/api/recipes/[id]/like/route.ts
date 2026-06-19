import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { handleApiError } from "@/lib/api";

// Toggle the current user's like on a recipe.
export async function POST(
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

  try {
    const existing = await prisma.like.findUnique({
      where: { userId_recipeId: { userId: session.userId, recipeId: id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({
        data: { userId: session.userId, recipeId: id },
      });
    }

    const count = await prisma.like.count({ where: { recipeId: id } });
    return NextResponse.json({ liked: !existing, count });
  } catch (error) {
    return handleApiError(error, "POST /api/recipes/[id]/like");
  }
}
