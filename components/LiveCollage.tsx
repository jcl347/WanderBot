"use client";

import React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  // Pass either a single query OR (preferred) a city + one-word terms
  leftQuery?: string;
  rightQuery?: string;
  leftCity?: string;
  rightCity?: string;
  leftTerms?: string[];   // e.g. ["South Beach","Nightlife","Wynwood Walls","Art"]
  rightTerms?: string[];
  leftCount?: number;
  rightCount?: number;
  className?: string;
};

export default function LiveCollage({
  leftQuery,
  rightQuery,
  leftCity,
  rightCity,
  leftTerms,
  rightTerms,
  leftCount = 12,
  rightCount = 12,
  className = "",
}: Props) {
  return (
    <div className={`relative grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)_300px] gap-4 md:gap-6 ${className}`}>
      {/* Left rail */}
      <div className="order-2 md:order-1">
        <LivePhotoPane
          query={leftQuery}
          city={leftCity}
          terms={leftTerms}
          count={leftCount}
        />
      </div>

      {/* Middle column left empty for main content */}
      <div className="order-1 md:order-2" />

      {/* Right rail */}
      <div className="order-3">
        <LivePhotoPane
          query={rightQuery}
          city={rightCity}
          terms={rightTerms}
          count={rightCount}
        />
      </div>
    </div>
  );
}
