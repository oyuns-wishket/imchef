import { describe, it, expect, vi } from "vitest";
import {
  extractArticleText,
  extractRecipeJsonLd,
  flattenInstructions,
  serializeRecipeJsonLd,
  fetchArticle,
  jsonLdToRecipe,
  parseIso8601Minutes,
  parseServings,
} from "./web";
import type { FetchLike } from "./youtube";

describe("extractArticleText", () => {
  it("제목 + 본문 추출, 노이즈 제거", () => {
    const html = `
      <html><head><title>된장찌개 레시피</title></head>
      <body>
        <nav>메뉴 홈 로그인</nav>
        <script>console.log('noise')</script>
        <article><h1>된장찌개</h1><p>두부를 썬다.</p><p>끓인다.</p></article>
        <footer>저작권 안내</footer>
      </body></html>`;
    const { title, text } = extractArticleText(html);
    expect(title).toBe("된장찌개 레시피");
    expect(text).toContain("두부를 썬다.");
    expect(text).toContain("끓인다.");
    expect(text).not.toContain("noise");
    expect(text).not.toContain("저작권");
    expect(text).not.toContain("메뉴 홈 로그인");
  });

  it("og:title 우선", () => {
    const html = `<html><head><meta property="og:title" content="OG 제목"><title>tab 제목</title></head><body><p>x</p></body></html>`;
    expect(extractArticleText(html).title).toBe("OG 제목");
  });
});

describe("extractRecipeJsonLd", () => {
  it("schema.org Recipe(@graph 포함) 추출", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"page"},
        {"@type":"Recipe","name":"김치볶음밥","recipeIngredient":["밥 1공기","김치 100g"],
         "recipeInstructions":[{"@type":"HowToStep","text":"김치를 볶는다"},{"@type":"HowToStep","text":"밥을 넣는다"}],
         "recipeYield":"2인분","totalTime":"PT15M"}
      ]}</script>`;
    const r = extractRecipeJsonLd(html);
    expect(r?.name).toBe("김치볶음밥");
    expect(r?.recipeIngredient).toEqual(["밥 1공기", "김치 100g"]);
  });

  it("Recipe 없으면 null", () => {
    const html = `<script type="application/ld+json">{"@type":"Article","name":"x"}</script>`;
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  it("깨진 JSON-LD는 건너뛴다", () => {
    const html = `<script type="application/ld+json">{broken</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"good"}</script>`;
    expect(extractRecipeJsonLd(html)?.name).toBe("good");
  });
});

describe("flattenInstructions", () => {
  it("문자열 배열", () => {
    expect(flattenInstructions(["a", "b"])).toEqual(["a", "b"]);
  });
  it("HowToStep 배열", () => {
    expect(
      flattenInstructions([
        { "@type": "HowToStep", text: "s1" },
        { "@type": "HowToStep", text: "s2" },
      ])
    ).toEqual(["s1", "s2"]);
  });
  it("HowToSection 중첩 평탄화", () => {
    expect(
      flattenInstructions([
        {
          "@type": "HowToSection",
          itemListElement: [
            { "@type": "HowToStep", text: "준비1" },
            { "@type": "HowToStep", text: "준비2" },
          ],
        },
      ])
    ).toEqual(["준비1", "준비2"]);
  });
});

describe("serializeRecipeJsonLd", () => {
  it("재료/순서를 평문으로 직렬화", () => {
    const text = serializeRecipeJsonLd({
      name: "불고기",
      recipeIngredient: ["소고기 300g", "간장 3큰술"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "재운다" },
        { "@type": "HowToStep", text: "굽는다" },
      ],
    });
    expect(text).toContain("제목: 불고기");
    expect(text).toContain("- 소고기 300g");
    expect(text).toContain("1. 재운다");
    expect(text).toContain("2. 굽는다");
  });
});

describe("parseIso8601Minutes", () => {
  it("PT15M → 15, PT1H30M → 90", () => {
    expect(parseIso8601Minutes("PT15M")).toBe(15);
    expect(parseIso8601Minutes("PT1H30M")).toBe(90);
    expect(parseIso8601Minutes("PT2H")).toBe(120);
  });
  it("미상/0은 null", () => {
    expect(parseIso8601Minutes(undefined)).toBeNull();
    expect(parseIso8601Minutes("PT0M")).toBeNull();
    expect(parseIso8601Minutes("garbage")).toBeNull();
  });
});

describe("parseServings", () => {
  it("문자열/숫자/배열에서 인분 추출", () => {
    expect(parseServings("2인분")).toBe(2);
    expect(parseServings("4 servings")).toBe(4);
    expect(parseServings(6)).toBe(6);
    expect(parseServings(["8"])).toBe(8);
    expect(parseServings(undefined)).toBe(1);
  });
});

describe("jsonLdToRecipe", () => {
  it("재료/순서/분량/시간을 RawRecipe로 변환", () => {
    const recipe = jsonLdToRecipe({
      name: "김치찌개",
      description: "얼큰한 김치찌개",
      recipeYield: "2인분",
      totalTime: "PT30M",
      recipeIngredient: ["김치 200g", "돼지고기 150g", "두부 1모"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "김치를 볶는다" },
        { "@type": "HowToStep", text: "물을 붓고 끓인다" },
      ],
    });
    expect(recipe.title).toBe("김치찌개");
    expect(recipe.servings).toBe(2);
    expect(recipe.cookTime).toBe(30);
    expect(recipe.ingredients.map((i) => i.name)).toEqual(["김치", "돼지고기", "두부"]);
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.steps[0].content).toBe("김치를 볶는다");
  });
});

describe("fetchArticle (주입 fetcher)", () => {
  it("성공 시 title/text/jsonLd 반환 + maxChars 절단", async () => {
    const html = `<html><head><title>T</title></head><body><article><p>${"가".repeat(50)}</p></article></body>
      <script type="application/ld+json">{"@type":"Recipe","name":"R"}</script></html>`;
    const fetcher: FetchLike = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(html) })
    );
    const out = await fetchArticle("https://blog.example/recipe", { fetcher, maxChars: 20 });
    expect(out.title).toBe("T");
    expect(out.text.length).toBeLessThanOrEqual(20);
    expect(out.jsonLd?.name).toBe("R");
  });

  it("HTTP 실패 시 throw", async () => {
    const fetcher: FetchLike = vi.fn(() =>
      Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve("") })
    );
    await expect(fetchArticle("https://x.com", { fetcher })).rejects.toThrow(/403/);
  });

  it("비-HTML Content-Type은 거부", async () => {
    const fetcher: FetchLike = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        contentType: "application/pdf",
        text: () => Promise.resolve("%PDF"),
      })
    );
    await expect(fetchArticle("https://x.com/f.pdf", { fetcher })).rejects.toThrow(
      /content-type/i
    );
  });

  it("사설/내부 URL은 SSRF 가드로 거부", async () => {
    const fetcher: FetchLike = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("") })
    );
    await expect(
      fetchArticle("http://169.254.169.254/meta", { fetcher })
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
