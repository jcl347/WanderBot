// components/MapLeaflet.tsx
"use client";

import dynamic from "next/dynamic";
import React from "react";

export type LeafletMarker = {
  position: [number, number];
  label?: string;
};

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: LeafletMarker[];
};

const MapLeafletInner = dynamic(() => import("./MapLeafletInner"), {
  ssr: false,
});

export default function MapLeaflet(props: Props) {
  return <MapLeafletInner {...props} />;
}
