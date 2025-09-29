"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

/**
 * Three-column layout with sticky image rails on desktop.
 * - Desktop (md+): [ left rail | children | right rail ]
 * - Mobile: children then a merged bottom collage
 */
export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 480,
  children,
  className = "",
  railClassName = "",
}: {
  leftTerms?: string[];
  rightTerms?: string[];
  bottomTerms?: string[];
  railWidth?: number;
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
}) {
  const mergedBottom = React.useMemo(() => {
    const b = bottomTerms && bottomTerms.length ? bottomTerms : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 18);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: children then a bottom collage */}
      <div className="md:hidden space-y-6">
        <div>{children}</div>
        {mergedBottom.length > 0 && (
          <div className="mt-2">
            <LivePhotoPane terms={mergedBottom} count={14} side="bottom" className="max-h-[80vh]" />
          </div>
        )}
      </div>

      {/* Desktop: true three-column grid */}
      <div
        className="hidden md:grid gap-6"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
        }}
      >
        <div className="self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={24}
              side="left"
              railWidth={railWidth}
              tileWidth={Math.min(300, Math.floor(railWidth * 0.9))}
              className={railClassName}
            />
          )}
        </div>

        <div className="min-w-0">{children}</div>

        <div className="self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={24}
              side="right"
              railWidth={railWidth}
              tileWidth={Math.min(300, Math.floor(railWidth * 0.9))}
              className={railClassName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
