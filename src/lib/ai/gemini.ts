import "server-only";
import { generateText } from "ai";
import { v4 as uuid } from "uuid";
import { getSupabase } from "@/lib/supabase";
import { assertAiCredentials } from "./auth";
import { AiError } from "./errors";
import { withRetry } from "./retry";

/**
 * AI 이미지 생성(이슈 #8 / AI 사진생성 복구).
 *
 * 기존 코드는 `generateImage({model:"google/imagen-4.0-generate-001"})`를 썼는데,
 * 해당 슬러그/경로가 게이트웨이에서 동작하지 않았다. 공식 권장(델타플랜 §3.1 +
 * AI SDK cookbook)은 `google/gemini-2.5-flash-image`(Nano Banana)를
 * generateText로 호출하고 result.files에서 이미지 바이트를 얻는 것이다.
 *
 * - n장은 모델이 1회 1장 경향이라 Promise.all로 병렬 생성(이슈 #8 §2).
 * - OIDC 우선 인증(키 없이 Vercel OIDC 동작).
 * - 생성/업로드 경계는 주입 가능해 키 없이 단위 테스트한다.
 */

export const GEMINI_IMAGE_MODEL = "google/gemini-2.5-flash-image" as const;

const RECIPE_PROMPT_PREFIX =
  "음식 사진, 요리 완성 사진, 깔끔한 배경, 자연광, 사실적인 스타일, 한식 표현에 적합, 정사각형 구도. 인물 없음, 텍스트 없음, 워터마크 없음, 로고 없음. 묘사: ";

export interface GeneratedImageResult {
  url: string;
}

export interface GeneratedImageBytes {
  bytes: Uint8Array;
  mediaType: string;
}

export interface ImageGenDeps {
  /** 프롬프트 1개로 이미지 1장 생성. 생성 결과 없으면 null. 모델 오류는 throw. */
  generateOne: (prompt: string) => Promise<GeneratedImageBytes | null>;
  /** 바이트를 저장하고 공개 URL을 반환. 실패 시 throw. */
  upload: (bytes: Uint8Array, mediaType: string) => Promise<string>;
}

// ─── 기본 의존성(프로덕션) ──────────────────────────────────────────────────

/**
 * generateText 결과에서 이미지 바이트를 추출(순수, SDK 결과 매핑 단위 테스트용).
 * 세이프티 차단이 throw 대신 빈 files로 오는 경우를 safety로 보존(handler가 403 분류).
 */
export function imageResultToBytes(result: {
  finishReason: string;
  files: ReadonlyArray<{ mediaType: string; uint8Array: Uint8Array }>;
}): GeneratedImageBytes | null {
  if (result.finishReason === "content-filter") {
    throw new AiError("safety", "이미지 생성이 세이프티 정책으로 차단됨");
  }
  const file = result.files.find((f) => f.mediaType.startsWith("image/"));
  if (file) return { bytes: file.uint8Array, mediaType: file.mediaType };

  // 이미지가 없을 때: 비정상 종료(error/length/other)는 에러로 표면화해 로그/분류에 남긴다.
  // finishReason="stop"의 빈 files만 "정상 무이미지"(null)로 본다 — 신호 없는 조용한 차단은
  // 정상 무이미지와 구분 불가하므로 safety로 단정하지 않는다.
  if (result.finishReason !== "stop") {
    throw new AiError("generic", `이미지 미생성(finishReason=${result.finishReason})`);
  }
  return null;
}

const defaultGenerateOne: ImageGenDeps["generateOne"] = (prompt) =>
  withRetry(async () =>
    imageResultToBytes(await generateText({ model: GEMINI_IMAGE_MODEL, prompt }))
  );

const defaultUpload: ImageGenDeps["upload"] = async (bytes, mediaType) => {
  const ext = mediaType.includes("jpeg") || mediaType.includes("jpg") ? "jpg" : "png";
  const filename = `ai/${uuid()}.${ext}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(filename, bytes, { contentType: mediaType, upsert: false });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from("recipe-images").getPublicUrl(filename);
  return data.publicUrl;
};

const defaultDeps: ImageGenDeps = {
  generateOne: defaultGenerateOne,
  upload: defaultUpload,
};

// ─── 핵심 ───────────────────────────────────────────────────────────────────

/**
 * 프롬프트로 n장 생성 후 저장하고 공개 URL 배열을 반환한다.
 * - 부분 성공 허용(성공분만 반환).
 * - 한 장도 생성 못했고 모델이 에러를 던졌으면 그 에러를 전파(라우트가 403/429/500 분류).
 */
export async function generateRecipeImages(
  prompt: string,
  n: number,
  deps: ImageGenDeps = defaultDeps
): Promise<GeneratedImageResult[]> {
  assertAiCredentials();

  const enhancedPrompt = `${RECIPE_PROMPT_PREFIX}${prompt}`;
  const count = Math.min(Math.max(1, Math.floor(n)), 4);

  // 1) n장 병렬 생성(개별 실패는 수집)
  const generated = await Promise.allSettled(
    Array.from({ length: count }, () => deps.generateOne(enhancedPrompt))
  );

  const images = generated
    .filter(
      (r): r is PromiseFulfilledResult<GeneratedImageBytes> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);

  if (images.length === 0) {
    // 전부 실패 → 세이프티/쿼터/키 등 원인 에러를 전파(라우트가 분류)
    const firstRejection = generated.find(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    if (firstRejection) throw firstRejection.reason;
    return [];
  }

  // 2) 병렬 업로드(부분 성공 허용)
  const uploaded = await Promise.allSettled(
    images.map((img) => deps.upload(img.bytes, img.mediaType))
  );

  return uploaded
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => ({ url: r.value }));
}
