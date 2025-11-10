"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  children: React.ReactNode;
  leftTerms?: string[];
  rightTerms?: string[];
  railWidth?: number;           // px per rail
  railClassName?: string;
  className?: string;
  railCols?: { sm?: number; md?: number; lg?: number; xl?: number };
};

export default function LiveCollage({
  children,
  leftTerms = [],
  rightTerms = [],
  railWidth = 560, // ⬅️ wider rails by default
  railClassName,
  className,
  railCols,
}: Props) {
  const cols = {
    sm: railCols?.sm ?? 2,
    md: railCols?.md ?? 2,
    lg: railCols?.lg ?? 2, // ⬅️ keep 2 cols on large screens for bigger tiles
    xl: railCols?.xl ?? 2,
  };

  const widthStyle: React.CSSProperties = {
    width: `${railWidth}px`,
    maxWidth: `${railWidth}px`,
    flex: `0 0 ${railWidth}px`,
  };

  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1200px)_minmax(0,1fr)]",
        "gap-6 md:gap-8 xl:gap-10 items-start",
        className || "",
      ].join(" ")}
    >
      {/* Left rail */}
      <div className="hidden md:block sticky top-20 self-start justify-self-end" style={widthStyle}>
        <LivePhotoPane
          side="left"
          terms={leftTerms}
          count={28}
          className={railClassName}
          cols={cols}
        />
      </div>

      {/* Center content */}
      <main className="mx-auto w-full max-w-[1200px] space-y-6">{children}</main>

      {/* Right rail */}
      <div className="hidden md:block sticky top-20 self-start justify-self-start" style={widthStyle}>
        <LivePhotoPane
          side="right"
          terms={rightTerms}
          count={28}
          className={railClassName}
          cols={cols}
        />
      </div>
    </div>
  );
}
