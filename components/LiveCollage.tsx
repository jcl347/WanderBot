// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

/**
 * Three-column wrapper:
 * - Desktop (md+):   [ left rail | children (analytics) | right rail ]
 * - Mobile (<md):    children, then (optionally) a single bottom collage (merged)
 *
 * Props let you pass distinct terms per rail; if bottomTerms is omitted,
 * it merges left+right for the mobile bottom rail automatically.
 */
export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 320,
  children,
  className = "",
  railClassName = "",
  showBottomOnMobile = true, // <-- NEW: toggle the mobile-bottom collage
}: {
  leftTerms?: string[];
  rightTerms?: string[];
  bottomTerms?: string[];
  railWidth?: number;
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  showBottomOnMobile?: boolean; // <-- NEW
}) {
  const mergedBottom = React.useMemo(() => {
    const b =
      bottomTerms && bottomTerms.length ? bottomTerms : [...leftTerms, ...rightTerms];
    // Keep it snappy on mobile
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: children then optional bottom collage */}
      <div className="md:hidden space-y-4">
        <div>{children}</div>
        {showBottomOnMobile && mergedBottom.length > 0 && (
          <LivePhotoPane
            terms={mergedBottom}
            count={16}
            side="left"
            className={railClassName}
          />
        )}
      </div>

      {/* Desktop: three-column with sticky rails */}
      <div
        className="hidden md:grid gap-4"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
        }}
      >
        <div className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={14}
              side="left"
              className={railClassName}
            />
          )}
        </div>

        <div>{children}</div>

        <div className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={14}
              side="right"
              className={railClassName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
