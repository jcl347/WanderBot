"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftQuery?: string;
  rightQuery?: string;
  leftList?: string[];
  rightList?: string[];
  leftCount?: number;
  rightCount?: number;
  railWidth?: number;     // px, default 380
  className?: string;
};

function toQuery(query?: string, list?: string[]) {
  if (query && query.trim()) return query.trim();
  if (Array.isArray(list) && list.length) {
    return list.filter((s) => typeof s === "string" && s.trim()).join(" ").trim();
  }
  return "";
}

export default function LiveCollage({
  leftQuery,
  rightQuery,
  leftList,
  rightList,
  leftCount = 12,
  rightCount = 12,
  railWidth = 380,
  className = "",
}: Props) {
  const lq = toQuery(leftQuery, leftList);
  const rq = toQuery(rightQuery, rightList);

  // clamp rail width
  const w = Math.max(260, Math.min(560, railWidth));
  const cols = `[${w}px_minmax(0,1fr)_[${w}px]]`;

  return (
    <div className={`relative grid grid-cols-1 md:grid-cols-[${w}px_minmax(0,1fr)_${w}px] gap-6 ${className}`}>
      {/* Left rail */}
      <div className="order-2 md:order-1">
        {lq ? (
          <LivePhotoPane query={lq} count={leftCount} />
        ) : (
          <div className="hidden md:block h-full rounded-xl border bg-white/50" />
        )}
      </div>

      {/* Middle content rendered by parent */}
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
