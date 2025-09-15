"use client";
import React from "react";
import MapLeaflet from "./MapLeaflet";

// A fun default set for the homepage (close-ish to demo places)
const DEMO_MARKERS = [
  { position: [38.72, -9.14] as [number, number], label: "Lisbon" },
  { position: [19.43, -99.13] as [number, number], label: "Mexico City" },
  { position: [45.50, -73.57] as [number, number], label: "Montreal" },
  { position: [32.72, -117.16] as [number, number], label: "San Diego" },
  { position: [21.30, -157.85] as [number, number], label: "Honolulu" },
];

export default function HomeMap() {
  return (
    <div className="h-64 w-full rounded-xl overflow-hidden border">
      <MapLeaflet center={[30, -30]} zoom={2} markers={DEMO_MARKERS} />
    </div>
  );
}
