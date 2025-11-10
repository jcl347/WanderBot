"use client";
import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 360,
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
    const b =
      bottomTerms && bottomTerms.length
        ? bottomTerms
        : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: content then a wide bottom collage */}
      <div className="md:hidden space-y-4 px-4">
        <div className="max-w-3xl mx-auto">{children}</div>
        {mergedBottom.length > 0 && (
          <LivePhotoPane
            terms={mergedBottom}
            count={16}
            side="left"
            className={`max-w-3xl mx-auto ${railClassName}`}
          />
        )}
      </div>

      {/* Desktop: perfectly centered 3-col grid */}
      <div
        className="hidden md:grid gap-6 max-w-[1600px] mx-auto px-6"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
        }}
      >
        <div className="sticky top-24 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane
              terms={leftTerms}
              count={18}
              side="left"
              className={railClassName}
            />
          )}
        </div>

        <div className="min-w-0">{children}</div>

        <div className="sticky top-24 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane
              terms={rightTerms}
              count={18}
              side="right"
              className={railClassName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
