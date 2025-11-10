// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

/**
 * Desktop (md+):   [ left rail | BIG center analytics | right rail ]
 * Mobile:          children only by default (optional bottom collage)
 */
export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 360,          // slightly slimmer rails so center can be thicker
  centerMinWidth = 840,     // make the middle pane “thick”
  children,
  className = "",
  railClassName = "",
  showBottomOnMobile = false,
}: {
  leftTerms?: string[];
  rightTerms?: string[];
  bottomTerms?: string[];
  railWidth?: number;
  centerMinWidth?: number;
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  showBottomOnMobile?: boolean;
}) {
  const mergedBottom = React.useMemo(() => {
    const b =
      bottomTerms && bottomTerms.length
        ? bottomTerms
        : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      <div
        className="hidden md:grid gap-8"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(${centerMinWidth}px, 1fr) ${railWidth}px`,
        }}
      >
        <div className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={24}
              columns={3}
              className={railClassName}
            />
          )}
        </div>

        <div className="min-w-0">{children}</div>

        <div className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={24}
              columns={3}
              className={railClassName}
            />
          )}
        </div>
      </div>

      {showBottomOnMobile && mergedBottom.length > 0 && (
        <div className="md:hidden mt-6">
          <LivePhotoPane terms={mergedBottom} count={16} columns={2} />
        </div>
      )}
    </div>
  );
}
