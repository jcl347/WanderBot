"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  children: React.ReactNode;

  // Search terms for each rail
  leftTerms?: string[];
  rightTerms?: string[];

  // Rail width and column density
  railWidth?: number; // px (applies to each rail independently)
  railClassName?: string;
  className?: string;

  // How many columns the rails should use per breakpoint
  railCols?: {
    sm?: number; // default 2
    md?: number; // default 2
    lg?: number; // default 3
    xl?: number; // default 3
  };
};

export default function LiveCollage({
  children,
  leftTerms = [],
  rightTerms = [],
  railWidth = 420,
  railClassName,
  className,
  railCols,
}: Props) {
  // Default rail density: 2 cols on small/medium, 3 on lg+
  const cols = {
    sm: railCols?.sm ?? 2,
    md: railCols?.md ?? 2,
    lg: railCols?.lg ?? 3,
    xl: railCols?.xl ?? 3,
  };

  const widthStyle: React.CSSProperties = {
    width: `${railWidth}px`,
    maxWidth: `${railWidth}px`,
    flex: `0 0 ${railWidth}px`,
  };

  return (
    <div
      className={[
        // 3 columns: rail | content | rail
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1200px)_minmax(0,1fr)]",
        "gap-6 md:gap-8",
        "items-start",
        className || "",
      ].join(" ")}
    >
      {/* Left rail */}
      <div
        className={[
          "hidden md:block sticky top-20 self-start",
          "justify-self-end",
        ].join(" ")}
        style={widthStyle}
      >
        <LivePhotoPane
          side="left"
          terms={leftTerms}
          count={26}
          className={railClassName}
          cols={cols}
        />
      </div>

      {/* Center content (nice & wide) */}
      <main className="mx-auto w-full max-w-[1200px] space-y-6">{children}</main>

      {/* Right rail */}
      <div
        className={[
          "hidden md:block sticky top-20 self-start",
          "justify-self-start",
        ].join(" ")}
        style={widthStyle}
      >
        <LivePhotoPane
          side="right"
          terms={rightTerms}
          count={26}
          className={railClassName}
          cols={cols}
        />
      </div>
    </div>
  );
}
