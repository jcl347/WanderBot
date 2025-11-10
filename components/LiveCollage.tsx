"use client";

import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

type Props = {
  children: React.ReactNode;
  leftTerms?: string[];
  rightTerms?: string[];
  railClassName?: string;
  className?: string;
  railCols?: { sm?: number; md?: number; lg?: number; xl?: number };
};

export default function LiveCollage({
  children,
  leftTerms = [],
  rightTerms = [],
  railClassName,
  className,
  railCols,
}: Props) {
  // Responsive rail columns
  const cols = {
    sm: railCols?.sm ?? 2,
    md: railCols?.md ?? 3,
    lg: railCols?.lg ?? 3,
    xl: railCols?.xl ?? 4, // 3–4 columns on big screens looks great
  };

  // Make rails stretch wider but still responsive on huge/compact screens
  const widthStyle: React.CSSProperties = {
    width: "clamp(680px, 26vw, 920px)",
    maxWidth: "clamp(680px, 26vw, 920px)",
    flex: "0 0 clamp(680px, 26vw, 920px)",
  };

  return (
    <div
      className={[
        // 3-column shell: left rail / center / right rail
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1240px)_minmax(0,1fr)]",
        "gap-6 md:gap-8 xl:gap-10 items-start",
        className || "",
      ].join(" ")}
    >
      {/* Left rail */}
      <aside
        className="hidden md:block sticky top-20 self-start justify-self-end z-0 overflow-visible"
        style={widthStyle}
      >
        <LivePhotoPane
          side="left"
          terms={leftTerms}
          count={60}
          className={railClassName}
          cols={cols}
        />
      </aside>

      {/* Center content */}
      <main className="mx-auto w-full max-w-[1240px] space-y-7 z-10">{children}</main>

      {/* Right rail */}
      <aside
        className="hidden md:block sticky top-20 self-start justify-self-start z-0 overflow-visible"
        style={widthStyle}
      >
        <LivePhotoPane
          side="right"
          terms={rightTerms}
          count={60}
          className={railClassName}
          cols={cols}
        />
      </aside>
    </div>
  );
}
