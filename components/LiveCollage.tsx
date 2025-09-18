"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  city: string;
  // Pass LLM-provided terms (already short/clean). We'll split between rails.
  terms: string[];
  className?: string;
  leftTotal?: number;
  rightTotal?: number;
};

export default function LiveCollage({
  city,
  terms,
  className = "",
  leftTotal = 16,
  rightTotal = 16,
}: Props) {
  const clean = (terms || []).map((t) => t.trim()).filter(Boolean);
  const mid = Math.ceil(clean.length / 2);
  const leftTerms = clean.slice(0, mid);
  const rightTerms = clean.slice(mid);

  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)_minmax(300px,380px)] gap-5 md:gap-8 ${className}`}
    >
      <div className="order-2 md:order-1">
        <LivePhotoPane city={city} terms={leftTerms} total={leftTotal} perTerm={8} className="h-full" />
      </div>

      <div className="order-1 md:order-2" />

      <div className="order-3">
        <LivePhotoPane city={city} terms={rightTerms} total={rightTotal} perTerm={8} className="h-full" />
      </div>
    </div>
  );
}
