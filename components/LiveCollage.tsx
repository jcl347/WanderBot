// components/LiveCollage.tsx
"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type RailCols = {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type Props = {
  children: React.ReactNode;
  leftTerms?: string[];
  rightTerms?: string[];
  railClassName?: string;
  className?: string;
  /** Optional responsive column counts for each rail */
  railCols?: RailCols;
};

export default function LiveCollage({
  children,
  leftTerms = [],
  rightTerms = [],
  railClassName,
  className,
  railCols,
}: Props) {
  // Responsive rail columns with sensible defaults
  const cols: Required<RailCols> = {
    base: railCols?.base ?? 2,
    sm:   railCols?.sm   ?? 2,
    md:   railCols?.md   ?? 2,
    lg:   railCols?.lg   ?? 3,
    xl:   railCols?.xl   ?? 4,
  };

  // Make rails stretch wider but keep center dominant and readable
  // You can tune these clamps if you want even wider rails.
  const railWidthStyle: React.CSSProperties = {
    width: "clamp(560px, 26vw, 940px)",
    maxWidth: "clamp(560px, 26vw, 940px)",
    flex: "0 0 clamp(560px, 26vw, 940px)",
  };

  return (
    <div
      className={[
        // 3-column layout: left rail / center / right rail
        "grid",
        "grid-cols-[minmax(0,1fr)_minmax(0,1400px)_minmax(0,1fr)]", // wider center
        "gap-6 md:gap-8 xl:gap-10 items-start",
        className || "",
      ].join(" ")}
    >
      {/* Left rail */}
      <aside
        className="hidden md:block sticky top-20 self-start justify-self-end z-0 overflow-visible"
        style={railWidthStyle}
        aria-hidden
      >
        <LivePhotoPane
          terms={leftTerms}
          className={railClassName}
          cols={cols}
        />
      </aside>

      {/* Center content */}
      <main className="mx-auto w-full max-w-[1400px] space-y-7 z-10">
        {children}
      </main>

      {/* Right rail */}
      <aside
        className="hidden md:block sticky top-20 self-start justify-self-start z-0 overflow-visible"
        style={railWidthStyle}
        aria-hidden
      >
        <LivePhotoPane
          terms={rightTerms}
          className={railClassName}
          cols={cols}
        />
      </aside>
    </div>
  );
}
