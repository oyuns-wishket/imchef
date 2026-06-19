import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { handleApiError } from "@/lib/api";

const MAX_LEN = 500;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = await prisma.comment.findMany({
      where: { recipeId: id },
      include: { user: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ comments });
  } catch (error) {
    return handleApiError(error, "GET /api/recipes/[id]/comments");
  }
}

export async function POST(
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

  const body = await req.json();
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json(
      { error: `댓글은 ${MAX_LEN}자 이하로 작성해주세요.` },
      { status: 400 }
    );
  }

  try {
    const comment = await prisma.comment.create({
      data: { content, userId: session.userId, recipeId: id },
      include: { user: { select: { id: true, nickname: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/recipes/[id]/comments");
  }
}
