// components/BackgroundMap.tsx
"use client";

import React from "react";

export default function BackgroundMap({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative min-h-screen w-full overflow-x-clip", // prevent horizontal seam/scroll
        className,
      ].join(" ")}
    >
      {/* Full-bleed fixed background layer (behind everything) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className={[
            "absolute inset-0",
            "bg-[url('https://tile.openstreetmap.org/0/0/0.png')]",
            "bg-no-repeat bg-cover",       // cover keeps it full; switch to md:bg-contain if you prefer
            "bg-[position:46%_center]",     // slight left bias to reduce perceived left whitespace
          ].join(" ")}
        />
        {/* Soft white scrim + blur for readability */}
        <div className="absolute inset-0 bg-white/75 backdrop-blur-sm" />
      </div>

      {/* Page content (slightly reduced left padding) */}
      <div className="relative z-10 mx-auto max-w-[1320px] px-4 md:px-6 pl-3 py-8 space-y-6">
        {children}
      </div>
    </div>
  );
}
