"use client";

import React from "react";
import { prewarmImages } from "@/lib/imageCache";

type Props = { queries: string[]; count?: number };

export default function PrewarmImages({ queries, count = 12 }: Props) {
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // limit to first few so we don't spam
      for (const q of queries.slice(0, 3)) {
        if (cancelled) break;
        prewarmImages(q, count);
      }
    })();
    return () => { cancelled = true; };
  }, [queries, count]);

  return null; // invisible worker
}
