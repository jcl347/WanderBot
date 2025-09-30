// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

/**
 * Three-column wrapper:
 * - Desktop (md+):   [ left rail | children (analytics) | right rail ]
 * - Mobile (<md):    children only by default; optionally show bottom collage (merged)
 *
 * Props let you pass distinct terms per rail; if showBottomOnMobile is true,
 * it merges left+right for the mobile bottom rail automatically.
 */
export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 420,
  children,
  className = "",
  railClassName = "",
  showBottomOnMobile = false,
}: {
  leftTerms?: string[];
  rightTerms?: string[];
  bottomTerms?: string[];
  railWidth?: number;
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
    // Keep it snappy on mobile
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Desktop: three-column with substantial, sticky rails */}
      <div
        className="hidden md:grid gap-6"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
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

        {/* Analytics in the middle */}
        <div>{children}</div>

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

      {/* Mobile: show only analytics by default; optional single bottom collage */}
      {showBottomOnMobile && mergedBottom.length > 0 && (
        <div className="md:hidden mt-6">
          <LivePhotoPane terms={mergedBottom} count={16} columns={2} />
        </div>
      )}
    </div>
  );
}
