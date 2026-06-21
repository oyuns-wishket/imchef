import { describe, it, expect, vi } from "vitest";
import { handleGenerateImage, type ImageRouteDeps } from "./handler";
import { AiError } from "@/lib/ai/errors";

const mkReq = (body: unknown) =>
  new Request("http://localhost/api/ai/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("handleGenerateImage", () => {
  it("정상 생성 → 200 + images", async () => {
    const deps: ImageRouteDeps = {
      getUserId: async () => "u1",
      generate: vi.fn(async () => [{ url: "https://cdn/a.png" }, { url: "https://cdn/b.png" }]),
    };
    const res = await handleGenerateImage(mkReq({ prompt: "된장찌개", n: 2 }), deps);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.images).toHaveLength(2);
  });

  it("미인증 → 401, generate 미호출", async () => {
    const generate = vi.fn();
    const res = await handleGenerateImage(mkReq({ prompt: "x" }), {
      getUserId: async () => null,
      generate,
    });
    expect(res.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("빈/초과 프롬프트 → 400", async () => {
    const deps: ImageRouteDeps = { getUserId: async () => "u1", generate: vi.fn() };
    expect((await handleGenerateImage(mkReq({ prompt: "  " }), deps)).status).toBe(400);
    expect(
      (await handleGenerateImage(mkReq({ prompt: "a".repeat(501) }), deps)).status
    ).toBe(400);
  });

  it("n 클램프해서 generate에 전달", async () => {
    const generate = vi.fn<ImageRouteDeps["generate"]>(async () => [{ url: "u" }]);
    await handleGenerateImage(mkReq({ prompt: "x", n: 99 }), {
      getUserId: async () => "u1",
      generate,
    });
    expect(generate.mock.calls[0][1]).toBe(4);
  });

  it("세이프티 차단 → 403 전용 메시지", async () => {
    const res = await handleGenerateImage(mkReq({ prompt: "x" }), {
      getUserId: async () => "u1",
      generate: async () => {
        throw new AiError("safety");
      },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("다른 묘사");
  });

  it("키 부재 → 500 친화 메시지(키 비노출)", async () => {
    const res = await handleGenerateImage(mkReq({ prompt: "x" }), {
      getUserId: async () => "u1",
      generate: async () => {
        throw new AiError("credentials");
      },
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("직접 업로드");
    expect(json.error).not.toMatch(/AI_GATEWAY_API_KEY/);
  });

  it("쿼터 초과 → 429", async () => {
    const res = await handleGenerateImage(mkReq({ prompt: "x" }), {
      getUserId: async () => "u1",
      generate: async () => {
        throw new Error("429 rate limit");
      },
    });
    expect(res.status).toBe(429);
  });

  it("0장 생성 → 500", async () => {
    const res = await handleGenerateImage(mkReq({ prompt: "x" }), {
      getUserId: async () => "u1",
      generate: async () => [],
    });
    expect(res.status).toBe(500);
  });
});
