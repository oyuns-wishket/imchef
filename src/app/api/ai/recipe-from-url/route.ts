import { getSessionUserId } from "@/lib/ai/route-helpers";
import { extractRecipeFromUrl } from "@/lib/ai/recipe";
import { handleRecipeFromUrl } from "./handler";

// 긴 영상/웹 분석 대비(이슈 #8 §2).
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleRecipeFromUrl(req, {
    getUserId: getSessionUserId,
    extract: (url) => extractRecipeFromUrl(url),
  });
}
