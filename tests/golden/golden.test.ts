import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_CASES } from "./fixtures";
import { evaluateGolden } from "./evaluate";
import {
  extractArticleText,
  extractRecipeJsonLd,
  jsonLdToRecipe,
} from "@/lib/ai/extract/web";
import { postProcessRecipe } from "@/lib/ai/postprocess";

/**
 * 결정론적 JSON-LD fast-path 회귀 (전체 KPI 아님 — evaluate.ts 범위 주석 참조).
 * schema.org/Recipe JSON-LD가 있는 입력에 한해 4요소(제목·재료·내용·순서)를
 * 모델 없이 ≥ 90% 추출함을 보장한다.
 */
describe("결정론적 JSON-LD 추출 경로 회귀 (4요소 ≥ 90%, 모델 비의존)", () => {
  const report = evaluateGolden(GOLDEN_CASES);

  it("골든셋이 충분한 규모(≥ 8건)", () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(8);
  });

  it("4요소 성공률 ≥ 90%", () => {
    if (report.failures.length > 0) {
      console.error(
        "실패 케이스:",
        report.failures.map((f) => ({ id: f.id, elements: f.elements }))
      );
    }
    expect(report.rate).toBeGreaterThanOrEqual(0.9);
  });

  it("각 요소(제목/재료/내용/순서)별로도 90% 이상", () => {
    const n = report.results.length;
    const ratio = (key: "title" | "ingredients" | "steps" | "order") =>
      report.results.filter((r) => r.elements[key]).length / n;
    expect(ratio("title")).toBeGreaterThanOrEqual(0.9);
    expect(ratio("ingredients")).toBeGreaterThanOrEqual(0.9);
    expect(ratio("steps")).toBeGreaterThanOrEqual(0.9);
    expect(ratio("order")).toBeGreaterThanOrEqual(0.9);
  });
});

/**
 * 정직성 보강: JSON-LD가 없는 실제풍 HTML(네이버/티스토리/일반 블로그 형태)은
 * 결정론적으로 4요소를 못 뽑고 모델 경유가 필요하다. 여기서는 그 경로의 전제 —
 * fast-path 불가 신호(JSON-LD null) + 본문/제목이 모델 입력으로 확보되고 노이즈가
 * 제거되는지 — 를 결정론적으로 검증한다.
 */
const NON_JSONLD_HTML_CASES = [
  {
    id: "집밥블로그(article)",
    html: `<html><head><title>두부조림 만들기 - 집밥블로그</title></head><body>
      <nav>홈 카테고리 로그인</nav>
      <article><h1>두부조림</h1><p>두부 한 모를 도톰하게 썬다.</p>
      <p>간장 3큰술, 고춧가루 1큰술로 양념장을 만든다.</p>
      <p>두부를 부치고 양념을 끼얹어 조린다.</p></article>
      <footer>댓글 12 저작권</footer></body></html>`,
    titleNeedle: "두부조림",
    bodyNeedles: ["두부 한 모를 도톰하게 썬다", "양념장을 만든다"],
    noiseNeedles: ["저작권", "홈 카테고리 로그인"],
  },
  {
    id: "네이버 블로그(se-main-container)",
    html: `<html><head><meta property="og:title" content="김치볶음밥 레시피"><title>네이버 블로그</title></head><body>
      <div id="header">블로그 이웃 공유</div>
      <main><div class="se-main-container">
      <p>찬밥 1공기를 준비한다.</p><p>김치 100g을 잘게 썰어 볶는다.</p>
      <p>밥을 넣고 간장 1큰술로 간한다.</p></div></main>
      <aside>인기글 광고</aside></body></html>`,
    titleNeedle: "김치볶음밥",
    bodyNeedles: ["찬밥 1공기를 준비한다", "간장 1큰술로 간한다"],
    noiseNeedles: ["광고", "이웃 공유"],
  },
  {
    id: "티스토리(article 본문)",
    html: `<html><head><title>닭볶음탕 황금레시피 :: 요리일기</title></head><body>
      <header>티스토리 메뉴 검색</header>
      <article class="article-view"><h2>닭볶음탕</h2>
      <p>닭 1kg을 토막내어 데친다.</p><p>고추장 2큰술과 고춧가루 2큰술을 넣는다.</p>
      <p>감자와 당근을 넣고 졸인다.</p></article>
      <div class="comments">댓글 35</div></body></html>`,
    titleNeedle: "닭볶음탕",
    bodyNeedles: ["닭 1kg을 토막내어 데친다", "감자와 당근을 넣고 졸인다"],
    noiseNeedles: ["댓글 35", "티스토리 메뉴 검색"],
  },
];

/**
 * 실제 캡처 스냅샷 골든: 만개의레시피 실제 페이지에서 추출한 진짜 JSON-LD.
 * 합성이 아닌 실 데이터로 추출 경로(extractRecipeJsonLd→jsonLdToRecipe→후처리) end-to-end 검증.
 */
describe("실제 캡처 골든 (만개의레시피 돼지고기장조림)", () => {
  const html = readFileSync(
    new URL("./fixtures/10000recipe-jangjorim.html", import.meta.url),
    "utf-8"
  );

  it("실 JSON-LD에서 4요소 추출 + 장식문자 제거", () => {
    const jsonLd = extractRecipeJsonLd(html);
    expect(jsonLd).not.toBeNull();
    const recipe = postProcessRecipe(jsonLdToRecipe(jsonLd!));

    expect(recipe.title).toContain("돼지고기장조림");
    expect(recipe.title).not.toContain("♥"); // 장식문자 제거됨
    expect(recipe.ingredients).toHaveLength(9);
    expect(recipe.steps).toHaveLength(6);
    expect(recipe.ingredients[0].name).toContain("돼지");
    expect(recipe.servings).toBe(4);
  });
});

describe("JSON-LD 없는 실제풍 HTML: 모델 입력 본문 확보(결정론 추출 아님)", () => {
  it("3건 모두 fast-path 불가(JSON-LD null)", () => {
    for (const c of NON_JSONLD_HTML_CASES) {
      expect(extractRecipeJsonLd(c.html), c.id).toBeNull();
    }
  });

  it.each(NON_JSONLD_HTML_CASES)(
    "$id: 제목·본문 확보 + 노이즈 제거",
    ({ html, titleNeedle, bodyNeedles, noiseNeedles }) => {
      const { title, text } = extractArticleText(html);
      expect(title).toContain(titleNeedle);
      for (const n of bodyNeedles) expect(text).toContain(n);
      for (const n of noiseNeedles) expect(text).not.toContain(n);
    }
  );
});
