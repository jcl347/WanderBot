// components/MapLeafletInner.tsx
"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LeafletMarker } from "./MapLeaflet";

// Tiny SVG marker (data URL) so we don't need public assets
const markerSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#0ea5e9">
    <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
  </svg>`
);

const icon =
  typeof window !== "undefined"
    ? L.icon({
        iconUrl: `data:image/svg+xml;utf8,${markerSvg}`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      })
    : undefined;

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: LeafletMarker[];
};

export default function MapLeafletInner({ center, zoom = 3, markers = [] }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full rounded-lg"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m, i) => (
        <Marker key={`${m.position[0]}-${m.position[1]}-${i}`} position={m.position} icon={icon as any}>
          {m.label && <Popup>{m.label}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
}
