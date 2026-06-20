import "server-only";
import { generateImage } from "ai";
import { v4 as uuid } from "uuid";
import { getSupabase } from "@/lib/supabase";

// Vercel AI Gateway 경유 Google Imagen 모델
export const GEMINI_IMAGE_MODEL = "google/imagen-4.0-generate-001" as const;

// 레시피 사진에 최적화된 시스템 프롬프트 접두사
const RECIPE_PROMPT_PREFIX =
  "음식 사진, 요리 사진, 깔끔한 배경, 자연광, 사실적인 스타일, 인물 없음, 텍스트 없음, 로고 없음: ";

export interface GeneratedImageResult {
  url: string;
}

/**
 * Google Imagen 모델로 이미지를 생성하고 Supabase Storage에 저장한다.
 * @param prompt 사용자 입력 프롬프트
 * @param n 생성할 이미지 수 (1~4)
 * @returns 저장 성공한 이미지 URL 배열
 */
export async function generateRecipeImages(
  prompt: string,
  n: number
): Promise<GeneratedImageResult[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const enhancedPrompt = `${RECIPE_PROMPT_PREFIX}${prompt}`;

  const { images } = await generateImage({
    model: GEMINI_IMAGE_MODEL,
    prompt: enhancedPrompt,
    n,
    aspectRatio: "1:1",
  });

  const supabase = getSupabase();
  const results: GeneratedImageResult[] = [];

  for (const image of images) {
    try {
      const filename = `ai/${uuid()}.png`;
      const bytes = image.uint8Array;

      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(filename, bytes, {
          contentType: "image/png",
          upsert: false,
        });

      if (error) {
        console.error("[ai/gemini] storage upload failed:", error.message);
        continue;
      }

      const { data } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(filename);

      results.push({ url: data.publicUrl });
    } catch (err) {
      console.error(
        "[ai/gemini] image save error:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return results;
}
