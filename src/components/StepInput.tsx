"use client";

interface Step {
  content: string;
}

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

export default function StepInput({ steps, onChange }: Props) {
  function add() {
    onChange([...steps, { content: "" }]);
  }

  function remove(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function update(index: number, content: string) {
    onChange(steps.map((s, i) => (i === index ? { content } : s)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-stone-700">조리 순서</label>
        <button type="button" onClick={add} className="text-xs text-stone-500 hover:text-stone-700">
          + 추가
        </button>
      </div>

      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-200 text-stone-600 text-xs font-medium flex items-center justify-center mt-2">
            {i + 1}
          </span>
          <textarea
            value={step.content}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`${i + 1}단계를 설명해주세요`}
            rows={2}
            className="input-field flex-1 resize-none"
          />
          {steps.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2.5 text-stone-300 hover:text-red-400 transition-colors"
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
