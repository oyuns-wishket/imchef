/**
 * 재료 한 줄("고추장 2큰술")을 {name, amount, unit}으로 분해하는 순수 휴리스틱.
 *
 * JSON-LD recipeIngredient는 자유 문자열이라, 결정론적으로 파싱하면 모델 없이도
 * 구조화된 재료를 얻을 수 있다(web fast-path + 골든셋 검증의 토대).
 */
import { normalizeUnit, type RawIngredient } from "../postprocess";

const KNOWN_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "L",
  "컵",
  "큰술",
  "작은술",
  "스푼",
  "티스푼",
  "그램",
  "그람",
  "킬로그램",
  "밀리리터",
  "리터",
  "개",
  "알",
  "장",
  "줌",
  "꼬집",
  "마리",
  "쪽",
  "톨",
  "공기",
  "대",
  "봉지",
  "봉",
  "캔",
  "팩",
  "조각",
  "큰개",
  "쪽파",
  "tbsp",
  "tsp",
  "T",
  "t",
]);

const VAGUE_AMOUNT = /(약간|적당량|조금|소량|톡톡|넉넉히)/;

export function parseIngredientLine(line: string): RawIngredient {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text) return { name: "", amount: "", unit: "" };

  // 1) 모호 수량("소금 약간")
  const vague = text.match(VAGUE_AMOUNT);
  if (vague) {
    const name = text.replace(VAGUE_AMOUNT, "").replace(/\s+/g, " ").trim();
    return { name: name || text, amount: "약간", unit: "" };
  }

  // 2) 끝에서 "수량 + 단위" 패턴 탐지
  // 예: "돼지고기 300g", "고추장 2 큰술", "대파 1대", "물 2컵"
  const m = text.match(/^(.*?)[\s]*([\d]+(?:[.,/]\d+)?|[½⅓¼¾⅔⅛])\s*([^\d\s]*)$/);
  if (m) {
    const [, rawName, amount, rawUnit] = m;
    const name = rawName.trim();
    const unitCandidate = rawUnit.trim();
    if (name) {
      // 단위 후보가 알려진 단위면 정규화, 아니면 name에 합치고 unit 비움
      if (unitCandidate && (KNOWN_UNITS.has(unitCandidate) || KNOWN_UNITS.has(unitCandidate.toLowerCase()))) {
        return { name, amount, unit: normalizeUnit(unitCandidate) };
      }
      if (!unitCandidate) {
        return { name, amount, unit: "" };
      }
      // 알 수 없는 꼬리표(예: "1인분")는 amount/unit에 같이 둔다
      return { name, amount, unit: unitCandidate };
    }
  }

  // 3) 분해 불가 — 이름만
  return { name: text, amount: "", unit: "" };
}
