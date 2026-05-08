import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { loginId, password } = await req.json();

  if (!loginId || !password) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

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
