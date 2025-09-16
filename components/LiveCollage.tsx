// components/LiveCollage.tsx
"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  // New-style (strings)
  leftQuery?: string;
  rightQuery?: string;

  // Old-style (arrays of phrases)
  leftList?: string[];
  rightList?: string[];

  leftCount?: number;
  rightCount?: number;
  className?: string;
};

function toQuery(query?: string, list?: string[]) {
  if (query && query.trim()) return query.trim();
  if (Array.isArray(list) && list.length) {
    return list
      .filter((s) => typeof s === "string" && s.trim())
      .join(" ")
      .trim();
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
  const lq = toQuery(leftQuery, leftList);
  const rq = toQuery(rightQuery, rightList);

  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)_260px] gap-4 md:gap-6 ${className}`}
    >
      <div className="order-2 md:order-1">
        {lq ? (
          <LivePhotoPane query={lq} count={leftCount} orientation="left" />
        ) : (
          <div className="hidden md:block h-full rounded-xl border bg-white/50" />
        )}
      </div>

      <div className="order-1 md:order-2" />

      <div className="order-3">
        {rq ? (
          <LivePhotoPane query={rq} count={rightCount} orientation="right" />
        ) : (
          <div className="hidden md:block h-full rounded-xl border bg-white/50" />
        )}
      </div>
    </div>
  );
}
