import type { GoldenCase } from "./evaluate";

/** JSON-LD script만 담은 최소 HTML(추출 경로 검증용). */
const ld = (obj: unknown) =>
  `<html><head><title>t</title></head><body><script type="application/ld+json">${JSON.stringify(
    obj
  )}</script></body></html>`;

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "jeyuk-howtostep-englishgloss",
    html: ld({
      "@type": "Recipe",
      name: "제육볶음 (Jeyuk-bokkeum recipe)",
      recipeIngredient: ["돼지고기 300g", "고추장 2큰술", "양파 1개", "소금 약간"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "돼지고기를 양념에 재운다" },
        { "@type": "HowToStep", text: "양파를 썬다" },
        { "@type": "HowToStep", text: "센 불에 볶는다" },
      ],
      recipeYield: "2인분",
      totalTime: "PT20M",
    }),
    expected: {
      title: "제육볶음",
      ingredientNames: ["돼지고기", "고추장", "양파", "소금"],
      steps: ["재운다", "썬다", "볶는다"],
    },
  },
  {
    id: "kimchijjigae-string-instructions",
    html: ld({
      "@type": "Recipe",
      name: "김치찌개",
      recipeIngredient: ["김치 200g", "돼지고기 150g", "두부 1모", "대파 1대"],
      recipeInstructions: ["김치를 볶는다", "물을 붓고 끓인다", "두부를 넣는다"],
      recipeYield: "3인분",
    }),
    expected: {
      title: "김치찌개",
      ingredientNames: ["김치", "돼지고기", "두부", "대파"],
      steps: ["볶는다", "끓인다", "넣는다"],
    },
  },
  {
    id: "bibimbap-graph-wrapped",
    html: ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "page" },
        {
          "@type": "Recipe",
          name: "비빔밥",
          recipeIngredient: ["밥 1공기", "나물 100g", "고추장 1큰술", "계란 1개"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "밥을 그릇에 담는다" },
            { "@type": "HowToStep", text: "나물을 올린다" },
            { "@type": "HowToStep", text: "고추장을 넣고 비빈다" },
          ],
        },
      ],
    }),
    expected: {
      title: "비빔밥",
      ingredientNames: ["밥", "나물", "고추장", "계란"],
      steps: ["담는다", "올린다", "비빈다"],
    },
  },
  {
    id: "doenjang-howtosection",
    html: ld({
      "@type": "Recipe",
      name: "된장찌개",
      recipeIngredient: ["된장 2큰술", "애호박 1/2개", "두부 1모", "감자 1개"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "준비",
          itemListElement: [
            { "@type": "HowToStep", text: "채소를 썬다" },
            { "@type": "HowToStep", text: "된장을 푼다" },
          ],
        },
        {
          "@type": "HowToSection",
          name: "조리",
          itemListElement: [{ "@type": "HowToStep", text: "끓인다" }],
        },
      ],
    }),
    expected: {
      title: "된장찌개",
      ingredientNames: ["된장", "애호박", "두부", "감자"],
      steps: ["썬다", "푼다", "끓인다"],
    },
  },
  {
    id: "bulgogi-numeric-yield",
    html: ld({
      "@type": "Recipe",
      name: "불고기",
      recipeIngredient: ["소고기 400g", "간장 3큰술", "설탕 1큰술", "배 1/4개"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "양념장을 만든다" },
        { "@type": "HowToStep", text: "고기를 재운다" },
        { "@type": "HowToStep", text: "팬에 굽는다" },
      ],
      recipeYield: 4,
    }),
    expected: {
      title: "불고기",
      ingredientNames: ["소고기", "간장", "설탕", "배"],
      steps: ["만든다", "재운다", "굽는다"],
    },
  },
  {
    id: "japchae-totaltime",
    html: ld({
      "@type": "Recipe",
      name: "잡채",
      recipeIngredient: ["당면 200g", "시금치 100g", "당근 1개", "간장 2큰술"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "당면을 삶는다" },
        { "@type": "HowToStep", text: "채소를 볶는다" },
        { "@type": "HowToStep", text: "함께 무친다" },
      ],
      totalTime: "PT25M",
    }),
    expected: {
      title: "잡채",
      ingredientNames: ["당면", "시금치", "당근", "간장"],
      steps: ["삶는다", "볶는다", "무친다"],
    },
  },
  {
    id: "gimbap-single-string-step",
    html: ld({
      "@type": "Recipe",
      name: "김밥",
      recipeIngredient: ["밥 2공기", "김 4장", "단무지 4줄", "시금치 100g"],
      recipeInstructions: "밥에 참기름을 넣고 김 위에 펴 재료를 올려 만다",
    }),
    expected: {
      title: "김밥",
      ingredientNames: ["밥", "김", "단무지", "시금치"],
      steps: ["만다"],
    },
  },
  {
    id: "tteokbokki-varied-units",
    html: ld({
      "@type": "Recipe",
      name: "떡볶이",
      recipeIngredient: ["떡 300g", "어묵 2장", "고추장 3큰술", "물 2컵", "설탕 1큰술"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "물을 끓인다" },
        { "@type": "HowToStep", text: "양념을 푼다" },
        { "@type": "HowToStep", text: "떡과 어묵을 넣고 졸인다" },
      ],
      recipeYield: "2인분",
    }),
    expected: {
      title: "떡볶이",
      ingredientNames: ["떡", "어묵", "고추장", "물", "설탕"],
      steps: ["끓인다", "푼다", "졸인다"],
    },
  },
  {
    id: "galbijjim-cooktime",
    html: ld({
      "@type": "Recipe",
      name: "갈비찜",
      recipeIngredient: ["소갈비 600g", "무 1개", "당근 1개", "간장 5큰술"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "갈비를 핏물 뺀다" },
        { "@type": "HowToStep", text: "양념에 졸인다" },
      ],
      cookTime: "PT1H",
    }),
    expected: {
      title: "갈비찜",
      ingredientNames: ["소갈비", "무", "당근", "간장"],
      steps: ["뺀다", "졸인다"],
    },
  },
  {
    id: "sundubu-type-array",
    html: ld({
      "@context": "https://schema.org",
      "@type": ["Recipe", "NewsArticle"], // @type 배열 변형(실제 사이트에 흔함)
      name: "순두부찌개",
      recipeIngredient: ["순두부 1봉", "바지락 100g", "고춧가루 1큰술", "계란 1개"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "고춧가루를 기름에 볶는다" },
        { "@type": "HowToStep", text: "물과 바지락을 넣는다" },
        { "@type": "HowToStep", text: "순두부와 계란을 넣고 끓인다" },
      ],
      recipeYield: "2인분",
    }),
    expected: {
      title: "순두부찌개",
      ingredientNames: ["순두부", "바지락", "고춧가루", "계란"],
      steps: ["볶는다", "넣는다", "끓인다"],
    },
  },
  {
    id: "gyeran-mari-simple",
    html: ld({
      "@type": "Recipe",
      name: "계란말이",
      recipeIngredient: ["계란 3개", "당근 1/4개", "대파 1대", "소금 약간"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "계란을 풀고 채소를 섞는다" },
        { "@type": "HowToStep", text: "팬에 부쳐 돌돌 만다" },
      ],
    }),
    expected: {
      title: "계란말이",
      ingredientNames: ["계란", "당근", "대파", "소금"],
      steps: ["섞는다", "만다"],
    },
  },
];
