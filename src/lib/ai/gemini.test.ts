import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateRecipeImages, imageResultToBytes, type ImageGenDeps } from "./gemini";
import { AiError } from "./errors";

const bytes = (n: number) => new Uint8Array([n]);

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("imageResultToBytes (SDK 결과 매핑)", () => {
  it("image/* 파일에서 바이트 추출", () => {
    const out = imageResultToBytes({
      finishReason: "stop",
      files: [
        { mediaType: "text/plain", uint8Array: bytes(0) },
        { mediaType: "image/png", uint8Array: bytes(7) },
      ],
    });
    expect(out).toEqual({ bytes: bytes(7), mediaType: "image/png" });
  });

  it("정상 종료(stop) + 이미지 없으면 null", () => {
    expect(imageResultToBytes({ finishReason: "stop", files: [] })).toBeNull();
  });

  it("content-filter는 safety AiError", () => {
    try {
      imageResultToBytes({ finishReason: "content-filter", files: [] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe("safety");
    }
  });

  it("비정상 종료(error/length) + 이미지 없으면 generic AiError로 표면화", () => {
    for (const fr of ["error", "length", "other"]) {
      try {
        imageResultToBytes({ finishReason: fr, files: [] });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(AiError);
        expect((e as AiError).kind).toBe("generic");
      }
    }
  });
});

describe("generateRecipeImages", () => {
  it("n장 병렬 생성 후 업로드 URL 반환", async () => {
    const deps: ImageGenDeps = {
      generateOne: vi.fn(async () => ({ bytes: bytes(1), mediaType: "image/png" })),
      upload: vi.fn(async () => "https://cdn/ai/x.png"),
    };
    const out = await generateRecipeImages("된장찌개", 2, deps);
    expect(out).toHaveLength(2);
    expect(out[0].url).toBe("https://cdn/ai/x.png");
    expect(deps.generateOne).toHaveBeenCalledTimes(2);
  });

  it("프롬프트에 음식 사진 컨텍스트 접두사 부착", async () => {
    const generateOne = vi.fn<ImageGenDeps["generateOne"]>(async () => ({
      bytes: bytes(1),
      mediaType: "image/png",
    }));
    await generateRecipeImages("불고기", 1, { generateOne, upload: async () => "u" });
    expect(generateOne.mock.calls[0][0]).toContain("음식 사진");
    expect(generateOne.mock.calls[0][0]).toContain("불고기");
  });

  it("n 클램프(1~4)", async () => {
    const generateOne = vi.fn<ImageGenDeps["generateOne"]>(async () => ({
      bytes: bytes(1),
      mediaType: "image/png",
    }));
    await generateRecipeImages("x", 99, { generateOne, upload: async () => "u" });
    expect(generateOne).toHaveBeenCalledTimes(4);
  });

  it("부분 성공: 업로드 일부 실패해도 성공분만 반환", async () => {
    let call = 0;
    const deps: ImageGenDeps = {
      generateOne: async () => ({ bytes: bytes(1), mediaType: "image/png" }),
      upload: vi.fn(async () => {
        call += 1;
        if (call === 1) throw new Error("storage 500");
        return "https://cdn/ok.png";
      }),
    };
    const out = await generateRecipeImages("x", 2, deps);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://cdn/ok.png");
  });

  it("생성 결과 null만 있으면 빈 배열(에러 아님)", async () => {
    const out = await generateRecipeImages("x", 2, {
      generateOne: async () => null,
      upload: async () => "u",
    });
    expect(out).toEqual([]);
  });

  it("전부 세이프티 차단이면 원인 에러 전파", async () => {
    const deps: ImageGenDeps = {
      generateOne: async () => {
        throw new Error("blocked by safety policy");
      },
      upload: async () => "u",
    };
    await expect(generateRecipeImages("x", 2, deps)).rejects.toThrow(/safety/);
  });

  it("키 부재 시 credentials AiError, 생성 미호출", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const generateOne = vi.fn(async () => ({ bytes: bytes(1), mediaType: "image/png" }));
    await expect(
      generateRecipeImages("x", 1, { generateOne, upload: async () => "u" })
    ).rejects.toBeInstanceOf(AiError);
    expect(generateOne).not.toHaveBeenCalled();
  });
});
