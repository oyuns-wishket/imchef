"use client";

import { useState } from "react";

interface Props {
  action: "edit" | "delete";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PasswordModal({ action, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900 mb-2">
          {action === "delete" ? "레시피 삭제" : "레시피 수정"}
        </h2>
        <p className="text-sm text-stone-500 mb-5">
          본인 확인을 위해 비밀번호를 입력해주세요.
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="input-field"
            autoFocus
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onCancel} className="btn-secondary">
              취소
            </button>
            <button
              type="submit"
              className={action === "delete" ? "btn-danger" : "btn-primary"}
              disabled={loading}
            >
              {loading
                ? "확인 중..."
                : action === "delete"
                  ? "삭제"
                  : "수정"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
