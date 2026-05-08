"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ images, onChange, maxImages = 3 }: Props) {
  const [uploading, setUploading] = useState(false);
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

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-stone-700">
        사진 ({images.length}/{maxImages})
      </label>
      <div className="flex gap-3 flex-wrap">
        {images.map((url, i) => (
          <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden bg-stone-100 group">
            <Image src={url} alt="" fill className="object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <label
            className="w-28 h-28 rounded-xl border-2 border-dashed border-stone-200
                       flex flex-col items-center justify-center cursor-pointer
                       hover:border-stone-400 transition-colors text-stone-400"
          >
            {uploading ? (
              <span className="text-xs">업로드중...</span>
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
      </div>
    </div>
  );
}
