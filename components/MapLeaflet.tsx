"use client";

import dynamic from "next/dynamic";
import React from "react";

// react-leaflet requires window — load dynamically
const Leaflet = dynamic(
  () => import("./MapLeafletInner").then((m) => m.MapLeafletInner),
  { ssr: false }
);

type Marker = { position: [number, number]; label?: string };

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: Marker[];
};

export default function MapLeaflet(props: Props) {
  return <Leaflet {...props} />;
}
