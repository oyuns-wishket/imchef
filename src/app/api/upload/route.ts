import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "JPG, PNG, WebP, GIF 형식만 지원합니다." },
      { status: 400 }
    );
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "파일 크기는 5MB 이하로 업로드해주세요." },
      { status: 400 }
    );
  }

  // Derive the extension from the validated MIME type, not the untrusted filename.
  const extByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extByType[file.type] || "jpg";
  const filename = `${uuid()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const supabase = getSupabase();

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(filename, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[api] upload to storage failed:", error.message);
      return NextResponse.json(
        { error: "이미지 업로드에 실패했습니다." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(filename);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error(
      "[api] upload route error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "이미지 업로드를 처리할 수 없습니다. 설정을 확인해주세요." },
      { status: 500 }
    );
  }
}
