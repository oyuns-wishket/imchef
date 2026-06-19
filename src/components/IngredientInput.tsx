"use client";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Props {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

const UNITS = ["g", "kg", "ml", "L", "개", "큰술", "작은술", "컵", "줌", "꼬집", "적당량"];

export default function IngredientInput({ ingredients, onChange }: Props) {
  function add() {
    onChange([...ingredients, { name: "", amount: "", unit: "g" }]);
  }

  function remove(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function update(index: number, field: keyof Ingredient, value: string) {
    const updated = ingredients.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    );
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink">재료</label>
        <button type="button" onClick={add} className="text-xs text-ink-soft hover:text-ink">
          + 추가
        </button>
      </div>

      {ingredients.map((ing, i) => (
        <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
          <input
            type="text"
            value={ing.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="재료명"
            className="input-field w-full sm:w-auto sm:flex-[2]"
          />
          <input
            type="text"
            value={ing.amount}
            onChange={(e) => update(i, "amount", e.target.value)}
            placeholder="양"
            className="input-field flex-1"
          />
          <select
            value={ing.unit}
            onChange={(e) => update(i, "unit", e.target.value)}
            className="input-field flex-1"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {ingredients.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2.5 text-ink-faint hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
