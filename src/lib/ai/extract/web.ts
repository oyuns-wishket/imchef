/**
 * 웹 페이지 본문 추출.
 *
 * 이슈 #8: file part로 text/html URL을 넘기면 모델이 실제 fetch하는지 불확실하고
 * 노이즈가 많다. 서버에서 본문을 텍스트로 뽑고, 가능하면 schema.org/Recipe
 * JSON-LD(레시피 사이트 표준 마크업)를 함께 추출해 정확도를 끌어올린다.
 *
 * 파싱은 순수 함수, 네트워크(fetch)는 주입.
 */
import * as cheerio from "cheerio";
import type { FetchLike } from "./youtube";
import { parseIngredientLine } from "./ingredient-parse";
import { assertPublicHttpUrl } from "./url-guard";
import type { RawRecipe } from "../postprocess";

const NOISE_SELECTORS =
  "script, style, noscript, nav, header, footer, aside, form, iframe, svg, button, .comments, #comments";

/** 응답 본문 문자 수 상한(메모리 가드). 일반 레시피 페이지는 수백 KB 수준. */
export const MAX_HTML_CHARS = 2_000_000;

/** HTML에서 제목과 본문 평문을 추출한다(노이즈 태그 제거). */
export function extractArticleText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "";

  $(NOISE_SELECTORS).remove();

  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("body");

  const text = root
    .text()
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return { title, text };
}

export interface RecipeJsonLd {
  name?: string;
  description?: string;
  recipeYield?: string | number | string[];
  totalTime?: string;
  cookTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** @graph/배열/단일 객체를 평탄화해 모든 노드를 순회한다. */
function flattenJsonLdNodes(parsed: unknown): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      nodes.push(obj);
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
    }
  };
  visit(parsed);
  return nodes;
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  const types = asArray(type as string | string[]).map((t) => String(t).toLowerCase());
  return types.includes("recipe");
}

/** HTML의 <script type="application/ld+json">에서 Recipe 노드를 추출한다. */
export function extractRecipeJsonLd(html: string): RecipeJsonLd | null {
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get();

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    const recipe = flattenJsonLdNodes(parsed).find(isRecipeNode);
    if (recipe) {
      return {
        name: recipe.name as string | undefined,
        description: recipe.description as string | undefined,
        recipeYield: recipe.recipeYield as RecipeJsonLd["recipeYield"],
        totalTime: recipe.totalTime as string | undefined,
        cookTime: recipe.cookTime as string | undefined,
        recipeIngredient: asArray(
          recipe.recipeIngredient as string | string[] | undefined
        ).map(String),
        recipeInstructions: recipe.recipeInstructions,
      };
    }
  }
  return null;
}

/** Recipe JSON-LD를 모델 입력용 평문으로 직렬화한다(있을 때만). */
export function serializeRecipeJsonLd(jsonLd: RecipeJsonLd): string {
  const parts: string[] = [];
  if (jsonLd.name) parts.push(`제목: ${jsonLd.name}`);
  if (jsonLd.description) parts.push(`소개: ${jsonLd.description}`);
  if (jsonLd.recipeYield) parts.push(`분량: ${asArray(jsonLd.recipeYield).join(", ")}`);
  if (jsonLd.totalTime || jsonLd.cookTime)
    parts.push(`시간: ${jsonLd.cookTime ?? jsonLd.totalTime}`);

  const ingredients = jsonLd.recipeIngredient ?? [];
  if (ingredients.length) parts.push(`재료:\n${ingredients.map((i) => `- ${i}`).join("\n")}`);

  const steps = flattenInstructions(jsonLd.recipeInstructions);
  if (steps.length)
    parts.push(`조리순서:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);

  return parts.join("\n");
}

/** recipeInstructions(string | HowToStep[] | HowToSection[])를 단계 문자열 배열로 평탄화. */
export function flattenInstructions(instructions: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      const t = node.trim();
      if (t) out.push(t);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const type = String(obj["@type"] ?? "").toLowerCase();
      if (type === "howtosection" && obj.itemListElement) {
        visit(obj.itemListElement);
      } else if (typeof obj.text === "string") {
        const t = obj.text.trim();
        if (t) out.push(t);
      } else if (typeof obj.name === "string") {
        const t = obj.name.trim();
        if (t) out.push(t);
      }
    }
  };
  visit(instructions);
  return out;
}

/** ISO-8601 duration("PT1H30M")을 분으로. 0/미상이면 null. */
export function parseIso8601Minutes(duration?: string): number | null {
  if (!duration) return null;
  const m = duration.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return total > 0 ? total : null;
}

/** recipeYield("2인분" | "4 servings" | 4)에서 인분 수를 추출(1~99). */
export function parseServings(yield_?: string | number | string[]): number {
  const clamp = (n: number) => Math.min(Math.max(1, Math.floor(n)), 99);
  if (typeof yield_ === "number") return clamp(yield_);
  for (const v of asArray(yield_)) {
    const m = String(v).match(/\d+/);
    if (m) return clamp(Number(m[0]));
  }
  return 1;
}

/** Recipe JSON-LD를 결정론적으로 RawRecipe로 변환(모델 우회 fast-path 토대). */
export function jsonLdToRecipe(jsonLd: RecipeJsonLd): RawRecipe {
  const ingredients = (jsonLd.recipeIngredient ?? [])
    .map(parseIngredientLine)
    .filter((i) => i.name.length > 0);
  const steps = flattenInstructions(jsonLd.recipeInstructions).map((content) => ({
    content,
  }));
  return {
    title: jsonLd.name?.trim() ?? "",
    description: jsonLd.description?.trim() ?? "",
    servings: parseServings(jsonLd.recipeYield),
    cookTime: parseIso8601Minutes(jsonLd.cookTime ?? jsonLd.totalTime),
    difficulty: "normal",
    ingredients,
    steps,
  };
}

export interface ArticleContent {
  title: string;
  text: string;
  jsonLd: RecipeJsonLd | null;
}

const ARTICLE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "ko,en;q=0.8",
};

export interface FetchArticleOptions {
  fetcher: FetchLike;
  /** 모델 입력 토큰 절감을 위한 본문 최대 길이. 기본 12000자. */
  maxChars?: number;
}

/** URL → { title, text, jsonLd }. 본문은 maxChars로 절단. */
export async function fetchArticle(
  url: string,
  { fetcher, maxChars = 12000 }: FetchArticleOptions
): Promise<ArticleContent> {
  assertPublicHttpUrl(url); // SSRF: 내부/사설 대상 차단
  const res = await fetcher(url, { headers: ARTICLE_HEADERS });
  if (!res.ok) {
    throw new Error(`web fetch failed: HTTP ${res.status}`);
  }
  // Content-Type 화이트리스트(HTML/XHTML/평문만) — 바이너리/미디어 차단.
  if (res.contentType && !/text\/html|application\/xhtml|text\/plain/i.test(res.contentType)) {
    throw new Error(`unsupported content-type: ${res.contentType}`);
  }
  // 응답 본문 길이 상한(메모리 가드). 파싱 전 절단.
  const html = (await res.text()).slice(0, MAX_HTML_CHARS);
  const { title, text } = extractArticleText(html);
  const jsonLd = extractRecipeJsonLd(html);
  return { title, text: text.slice(0, maxChars), jsonLd };
}
