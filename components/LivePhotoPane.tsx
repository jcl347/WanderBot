// components/LivePhotoPane.tsx
"use client";
import * as React from "react";
import Image from "next/image";

// If you previously exported a Props type, update it in place.
// Otherwise define it here:
type Props = {
  terms: string[];
  count?: number;
  className?: string;
  /** which rail this pane sits on (used for subtle layout tweaks) */
  side?: "left" | "right";
};

export default function LivePhotoPane({
  terms,
  count = 12,
  className = "",
  side = "left",
}: Props) {
  // ...your existing fetching/preloading code...

  // Example of using `side` to tweak alignment or gradient direction:
  const railAlign = side === "left" ? "items-start" : "items-end";

  return (
    <div className={`flex flex-col gap-3 ${railAlign} ${className}`}>
      {/* your existing collage grid */}
      {/* Example skeleton illustrating placement; keep your current map over images */}
      {/* <div className="grid grid-cols-2 gap-3 w-full"> ... </div> */}
    </div>
  );
}
