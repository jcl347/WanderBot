"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  leftTerms?: string[];
  rightTerms?: string[];
  /** Optional extra terms for a bottom rail (mobile/short pages). Not required. */
  bottomTerms?: string[];
  /** Rail width in px on large screens */
  railWidth?: number;
  /** Wrapper class for the center column container */
  className?: string;
  /** Extra classes for rail panes */
  railClassName?: string;
  children: React.ReactNode;
};

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms = [],
  railWidth = 340,
  className = "",
  railClassName = "",
  children,
}: Props) {
  return (
    <div
      className="grid gap-6"
      style={{
        gridTemplateColumns:
          // 1 col on mobile; on lg: left rail | center | right rail
          "minmax(0,1fr)",
      }}
    >
      <div
        className="hidden lg:grid gap-6"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px`,
        }}
      >
        <LivePhotoPane
          terms={leftTerms}
          count={18}
          side="left"
          className={`sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 ${railClassName}`}
        />
        <div className={`min-w-0 ${className}`}>{children}</div>
        <LivePhotoPane
          terms={rightTerms}
          count={18}
          side="right"
          className={`sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-2 ${railClassName}`}
        />
      </div>

      {/* Mobile: center content first, then a light bottom strip of photos */}
      <div className="lg:hidden">
        <div className={className}>{children}</div>
        {bottomTerms.length > 0 && (
          <div className="mt-6">
            <LivePhotoPane
              terms={bottomTerms}
              count={12}
              side="left"
              className="max-w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
