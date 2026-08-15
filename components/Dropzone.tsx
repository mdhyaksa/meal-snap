"use client";

import { useRef, useState } from "react";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function Dropzone({
  onImage,
  error,
}: {
  onImage: (dataUrl: string) => void;
  error: string | null;
}) {
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const shown = localError ?? error;

  function take(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError("That file isn't a JPG, PNG or WebP image we can read.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("That image is larger than 5 MB. Try a smaller photo.");
      return;
    }
    setLocalError(null);

    const reader = new FileReader();
    reader.onload = () => onImage(String(reader.result));
    reader.onerror = () => setLocalError("Couldn't read that file. Try another photo.");
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div
        className={`drop${over ? " over" : ""}${shown ? " error" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
      >
        <div className="ico" aria-hidden>
          {shown ? "⚠️" : "🥗"}
        </div>
        <b>{shown ?? "Drag a photo here"}</b>
        <small>{shown ? "JPG, PNG or WebP under 5 MB." : "or click to choose a file"}</small>
        <div>
          <button type="button" className="btn" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
            Choose photo
          </button>
        </div>
        <input
          ref={input}
          type="file"
          className="visually-hidden"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="hint">JPG, PNG or WebP · up to 5 MB · your photo is sent only to the nutrition model</p>
    </>
  );
}
