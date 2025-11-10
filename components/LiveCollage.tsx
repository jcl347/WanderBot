// components/LiveCollage.tsx
"use client";
import * as React from "react";
import LivePhotoPane from "./LivePhotoPane";

export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  bottomTerms,
  railWidth = 360,
  centerMinWidth = 840,
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
    const b = bottomTerms?.length ? bottomTerms : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 16);
  }, [bottomTerms, leftTerms, rightTerms]);

  // On narrow desktops, trim rail a touch to avoid 1–2px overflow + scrollbar
  const effectiveRail = typeof window !== "undefined" && window.innerWidth < 1200
    ? Math.max(300, railWidth - 24)
    : railWidth;

  return (
    <div className={["md:mx-auto md:max-w-[min(1700px,100vw)]", className].join(" ")}>
      <div
        className="hidden md:grid gap-7" // slightly smaller gap to keep within viewport
        style={{
          gridTemplateColumns: `${effectiveRail}px minmax(${centerMinWidth}px, 1fr) ${effectiveRail}px`,
        }}
      >
        <div className="sticky top-20 self-start">
          {leftTerms.length > 0 && (
            <LivePhotoPane terms={leftTerms} count={24} columns={3} className={railClassName} />
          )}
        </div>

        <div className="min-w-0">{children}</div>

        <div className="sticky top-20 self-start">
          {rightTerms.length > 0 && (
            <LivePhotoPane terms={rightTerms} count={24} columns={3} className={railClassName} />
          )}
        </div>
      </div>

      {showBottomOnMobile && mergedBottom.length > 0 && (
        <div className="md:hidden mt-6">
          <LivePhotoPane terms={mergedBottom} count={16} columns={2} />
        </div>
      )}
    </div>
  );
}
