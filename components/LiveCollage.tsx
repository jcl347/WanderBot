// components/LiveCollage.tsx
"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  // Accept either a single query or a list of short phrases.
  // If both are provided, the single query wins.
  leftQuery?: string;
  rightQuery?: string;
  leftList?: string[];
  rightList?: string[];

  leftCount?: number;
  rightCount?: number;
  className?: string;
};

/**
 * Keep Wikimedia search simple. If a list is provided,
 * we take the FIRST non-empty phrase only (e.g., "Miami South Beach").
 */
function pickSimpleQuery(list?: string[]): string {
  if (!Array.isArray(list)) return "";
  for (const s of list) {
    if (typeof s === "string" && s.trim()) return s.trim();
  }
  return "";
}

export default function LiveCollage({
  leftQuery,
  rightQuery,
  leftList,
  rightList,
  leftCount = 10,
  rightCount = 10,
  className = "",
}: Props) {
  const lq = (leftQuery && leftQuery.trim()) || pickSimpleQuery(leftList);
  const rq = (rightQuery && rightQuery.trim()) || pickSimpleQuery(rightList);

  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)_260px] gap-4 md:gap-6 ${className}`}
    >
      {/* Left rail */}
      <div className="order-2 md:order-1">
        {lq ? (
          <LivePhotoPane query={lq} count={leftCount} />
        ) : (
          <div className="hidden md:block h-full rounded-xl border bg-white/50" />
        )}
      </div>

      {/* Middle column is intentionally empty – caller renders content there */}
      <div className="order-1 md:order-2" />

      {/* Right rail */}
      <div className="order-3">
        {rq ? (
          <LivePhotoPane query={rq} count={rightCount} />
        ) : (
          <div className="hidden md:block h-full rounded-xl border bg-white/50" />
        )}
      </div>
    </div>
  );
}
