// components/LiveCollage.tsx
"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftList?: string[];   // e.g., ["Miami South Beach", "Miami Wynwood"]
  rightList?: string[];
  leftCount?: number;
  rightCount?: number;
  className?: string;
};

export default function LiveCollage({
  leftList = [],
  rightList = [],
  leftCount = 14,
  rightCount = 14,
  className = "",
}: Props) {
  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(280px,360px)] gap-6 ${className}`}
    >
      {/* Left rail */}
      <div className="order-2 md:order-1">
        {leftList.length ? (
          <LivePhotoPane terms={leftList} count={leftCount} orientation="left" />
        ) : (
          <div className="hidden md:block h-[560px] rounded-xl border bg-white/50" />
        )}
      </div>

      {/* Middle column: caller renders content here */}
      <div className="order-1 md:order-2" />

      {/* Right rail */}
      <div className="order-3">
        {rightList.length ? (
          <LivePhotoPane terms={rightList} count={rightCount} orientation="right" />
        ) : (
          <div className="hidden md:block h-[560px] rounded-xl border bg-white/50" />
        )}
      </div>
    </div>
  );
}
