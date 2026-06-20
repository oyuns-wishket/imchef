"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Spinner from "@/components/ui/Spinner";
import AiImageGenerator from "@/components/AiImageGenerator";
import { Sparkle } from "@/components/icons";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ images, onChange, maxImages = 3 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      onChange([...images, url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleAiSelect(url: string) {
    if (images.length >= maxImages) return;
    onChange([...images, url]);
  }

  const canAdd = images.length < maxImages;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-ink">
        사진 ({images.length}/{maxImages})
      </label>
      <div className="flex gap-3 flex-wrap">
        {images.map((url, i) => (
          <div key={i} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white/60 group">
            <Image src={url} alt="" fill className="object-contain" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white
                         flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}

        {/* 수동 업로드 타일 */}
        {canAdd && (
          <label
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-line
                       flex flex-col items-center justify-center cursor-pointer
                       hover:border-[--color-accent] transition-colors text-ink-faint"
          >
            {uploading ? (
              <Spinner size="md" label="업로드 중" />
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">사진 추가</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}

        {/* AI 이미지 생성 타일 */}
        {canAdd && (
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex flex-col items-center justify-center gap-1
                       transition-colors hover:bg-black/5"
            style={{
              border: "1px solid var(--color-edge)",
              background: "transparent",
            }}
            aria-label="AI 이미지 생성"
          >
            <Sparkle className="h-5 w-5 text-ink" />
            <span className="text-xs font-medium text-ink-soft">AI 생성</span>
          </button>
        )}
      </div>

      {/* AI 이미지 생성 모달 */}
      {aiOpen && (
        <AiImageGenerator
          imageCount={images.length}
          maxImages={maxImages}
          onSelect={handleAiSelect}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}
