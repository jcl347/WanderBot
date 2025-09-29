"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftTerms?: string[];
  rightTerms?: string[];
  bottomTerms?: string[];
  /** rail width on desktop (px) */
  railWidth?: number;
  /** tile height (px) for image cards inside rails */
  railTileHeight?: number;
  className?: string;
  railClassName?: string;
  children: React.ReactNode;
};

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 520,         // WIDE by default
  railTileHeight = 280,    // big tiles so the micro-itineraries are visible
  className = "",
  railClassName = "",
  children,
}: Props) {
  const mergedBottom = React.useMemo(() => {
    const b =
      bottomTerms && bottomTerms.length
        ? bottomTerms
        : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 18);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: show content then a big collage */}
      <div className="md:hidden space-y-5">
        <div>{children}</div>
        {mergedBottom.length > 0 && (
          <LivePhotoPane
            terms={mergedBottom}
            count={12}
            orientation="left"
            tileHeight={railTileHeight}
            className={railClassName}
          />
        )}
      </div>

      {/* Desktop: BIG left & right rails, sticky for easy viewing */}
      <div
        className="hidden md:grid gap-6 xl:gap-8"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
        }}
      >
        <div className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={16}
              orientation="left"
              tileHeight={railTileHeight}
              className={railClassName}
            />
          )}
        </div>

        <div>{children}</div>

        <div className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={16}
              orientation="right"
              tileHeight={railTileHeight}
              className={railClassName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
