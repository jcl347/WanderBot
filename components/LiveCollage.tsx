// components/LiveCollage.tsx
"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  city: string;
  terms: string[]; // short phrases only, e.g., ["South Beach","Wynwood","Art Deco"]
  className?: string;
  leftTotal?: number;
  rightTotal?: number;
};

export default function LiveCollage({
  city,
  terms,
  className = "",
  leftTotal = 18,
  rightTotal = 18,
}: Props) {
  const mid = Math.ceil(terms.length / 2);
  const leftTerms = terms.slice(0, mid);
  const rightTerms = terms.slice(mid);

  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-[minmax(220px,340px)_minmax(0,1fr)_minmax(220px,340px)] gap-4 md:gap-8 ${className}`}
    >
      {/* Left rail */}
      <div className="order-2 md:order-1">
        <LivePhotoPane city={city} terms={leftTerms} count={leftTotal} orientation="left" />
      </div>

      {/* Middle content (caller fills this area) */}
      <div className="order-1 md:order-2" />

      {/* Right rail */}
      <div className="order-3">
        <LivePhotoPane city={city} terms={rightTerms} count={rightTotal} orientation="right" />
      </div>
    </div>
  );
}
