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
  railWidth = 440,          // wider rails so images are more visible
  centerMinWidth = 1100,    // thicker middle pane
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
    return Array.from(new Set(b)).slice(0, 24);
  }, [bottomTerms, leftTerms, rightTerms]);

  // Merge a pleasant default rail gap with any custom class passed in
  const mergedRailClass = ["gap-3 md:gap-4", railClassName].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <div
        className="hidden md:grid items-start gap-6 md:gap-8"
        style={{
          // push rails closer while keeping a robust center
          gridTemplateColumns: `${railWidth}px minmax(${centerMinWidth}px, 1fr) ${railWidth}px`,
        }}
      >
        {/* Left rail */}
        <aside className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={48}          // more images
              columns={2}         // larger tiles; LivePhotoPane handles layout
              className={mergedRailClass}
            />
          )}
        </aside>

        {/* Center content */}
        <main className="min-w-0">{children}</main>

        {/* Right rail */}
        <aside className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={48}
              columns={2}
              className={mergedRailClass}
            />
          )}
        </aside>
      </div>

      {showBottomOnMobile && mergedBottom.length > 0 && (
        <div className="md:hidden mt-6">
          <LivePhotoPane terms={mergedBottom} count={20} columns={2} className="gap-3" />
        </div>
      )}
    </div>
  );
}
