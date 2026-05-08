import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { loginId, password, nickname } = await req.json();

  if (!loginId || !password || !nickname) {
    return NextResponse.json(
      { error: "모든 필드를 입력해주세요." },
      { status: 400 }
    );
  }

  if (loginId.length < 4 || loginId.length > 20) {
    return NextResponse.json(
      { error: "아이디는 4~20자로 입력해주세요." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 6자 이상으로 입력해주세요." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다." },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { loginId, password: hashedPassword, nickname },
  });

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.userId = user.id;
  session.loginId = user.loginId;
  session.nickname = user.nickname;
  await session.save();

  return NextResponse.json({
    id: user.id,
    loginId: user.loginId,
    nickname: user.nickname,
  });
}
