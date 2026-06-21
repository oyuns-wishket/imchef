import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { parseYoutubeVideoId } from "./youtube";

/**
 * Stage 1 (Vision): YouTube 영상을 Gemini가 직접 보고 레시피를 자연어로 서술한다.
 *
 * 실측(2026-06-21): Vercel AI Gateway 경유로는 영상이 인제스트되지 않고 환각이 발생한다
 * (토큰 57만~72만인데 "영상 시청 불가"). @ai-sdk/google **직결** + youtube URL을
 * **string**으로 + **watch 형식**으로 넘기면 영상을 실제로 본다(타임스탬프·정확한 계량).
 */

export const VISION_PROMPT = `이 요리 영상을 보고 레시피를 한국어로 상세히 정리해줘.
- 제목: 요리명
- 인분, 조리시간(분), 난이도(쉬움/보통/어려움)
- 재료: 영상에 나온 그대로 이름/양/단위를 구분해서 모두
- 조리순서: 영상 진행 순서대로 단계별로 빠짐없이
영상을 볼 수 없으면 추측하지 말고 "영상 시청 불가"라고만 답해줘.`;

const UNINGESTED_PATTERNS =
  /시청\s*할?\s*수\s*없|볼\s*수\s*없|재생\s*할?\s*수\s*없|영상\s*시청\s*불가|직접\s*시청할\s*수\s*없/;

/** 다양한 YouTube URL을 watch 형식으로 정규화(직결이 watch+string을 요구). */
export function toWatchUrl(url: string): string | null {
  const id = parseYoutubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** 응답이 "영상을 못 봤다"는 신호를 담고 있는지(미인제스트 판정). */
export function looksUningested(text: string): boolean {
  return UNINGESTED_PATTERNS.test(text);
}

export interface VisionGenerate {
  (input: { model: string; videoUrl: string; prompt: string }): Promise<{
    text: string;
    inputTokens: number | null;
  }>;
}

export interface VisionResult {
  text: string;
  inputTokens: number | null;
  ingested: boolean;
}

export interface VisionOptions {
  generate: VisionGenerate;
  model: string; // "gemini-2.5-flash" | "gemini-2.5-pro" (provider prefix 없이)
}

/** 프로덕션 기본 generate: @ai-sdk/google 직결 호출(영상 string + watch 형식). */
export const defaultVisionGenerate: VisionGenerate = async ({ model, videoUrl, prompt }) => {
  const r = await generateText({
    model: google(model),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "file", data: videoUrl, mediaType: "video/mp4" },
        ],
      },
    ],
  });
  return { text: r.text, inputTokens: r.usage?.inputTokens ?? null };
};

/**
 * URL → 영상 분석 레시피 텍스트. youtube가 아니거나 미인제스트면 ingested=false.
 */
export async function extractRecipeTextFromVideo(
  url: string,
  { generate, model }: VisionOptions
): Promise<VisionResult> {
  const watchUrl = toWatchUrl(url);
  if (!watchUrl) {
    return { text: "", inputTokens: null, ingested: false };
  }

  const { text, inputTokens } = await generate({ model, videoUrl: watchUrl, prompt: VISION_PROMPT });
  // 미인제스트는 주로 looksUningested로 판정. 길이(30)는 거의 빈 응답 방어용.
  const ingested = text.trim().length >= 30 && !looksUningested(text);
  return { text, inputTokens, ingested };
}
