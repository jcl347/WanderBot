// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftTerms?: string[];
  rightTerms?: string[];
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  railWidth?: number;           // px
};

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  children,
  className,
  railClassName,
  railWidth = 260,
}: Props) {
  return (
    <div className={["mx-auto w-full max-w-[1900px] px-4 md:px-8", className || ""].join(" ")}>
      {/* Desktop: 3 columns (rail | wide center | rail) */}
      <div
        className="hidden md:grid gap-6"
        style={{ gridTemplateColumns: `${railWidth}px minmax(900px,1fr) ${railWidth}px` }}
      >
        <div className={railClassName}>
          <LivePhotoPane terms={leftTerms} count={36} side="left" />
        </div>

        <div className="space-y-6">{children}</div>

        <div className={railClassName}>
          <LivePhotoPane terms={rightTerms} count={36} side="right" />
        </div>
      </div>

      {/* Mobile: center content first, rails below (optional) */}
      <div className="md:hidden space-y-6">
        <div>{children}</div>
        {leftTerms.length > 0 && (
          <div className="mt-4">
            <LivePhotoPane terms={leftTerms} count={24} side="left" />
          </div>
        )}
        {rightTerms.length > 0 && (
          <div className="mt-4">
            <LivePhotoPane terms={rightTerms} count={24} side="right" />
          </div>
        )}
      </div>
    </div>
  );
}
