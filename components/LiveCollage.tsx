// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftTerms?: string[];
  rightTerms?: string[];
  /** If omitted, mobile uses both left+right terms merged at bottom */
  bottomTerms?: string[];
  children: React.ReactNode;
  /** Default rail widths adjusted responsively */
  className?: string;
  railClassName?: string;
};

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  children,
  className = "",
  railClassName = "",
}: Props) {
  const mergedBottom = React.useMemo(() => {
    const b = bottomTerms && bottomTerms.length ? bottomTerms : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: content then one collage rail underneath */}
      <div className="md:hidden space-y-4">
        <div>{children}</div>
        {mergedBottom.length > 0 && (
          <LivePhotoPane terms={mergedBottom} count={16} side="left" className={railClassName} />
        )}
      </div>

      {/* Desktop and up: sticky rails with a *wide* middle column */}
      <div
        className={[
          "hidden md:grid gap-6 mx-auto px-4",
          // min 380–460px rails, center min 720–840px
          "lg:grid-cols-[minmax(340px,380px)_minmax(640px,1fr)_minmax(340px,380px)]",
          "xl:grid-cols-[minmax(380px,420px)_minmax(720px,1fr)_minmax(380px,420px)]",
          "2xl:grid-cols-[minmax(420px,460px)_minmax(840px,1fr)_minmax(420px,460px)]",
          "max-w-[1900px]",
        ].join(" ")}
      >
        <div className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane terms={leftTerms} count={24} side="left" className={railClassName} />
          )}
        </div>

        <div>{children}</div>

        <div className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane terms={rightTerms} count={24} side="right" className={railClassName} />
          )}
        </div>
      </div>
    </div>
  );
}
