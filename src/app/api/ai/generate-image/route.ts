import { getSessionUserId } from "@/lib/ai/route-helpers";
import { generateRecipeImages } from "@/lib/ai/gemini";
import { handleGenerateImage } from "./handler";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handleGenerateImage(req, {
    getUserId: getSessionUserId,
    generate: (prompt, n) => generateRecipeImages(prompt, n),
  });
}
