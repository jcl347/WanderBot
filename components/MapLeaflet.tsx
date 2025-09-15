// components/MapLeaflet.tsx
"use client";
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  center?: [number, number];
  zoom?: number;
  markers?: { id?: string; position: [number, number]; label?: string }[];
  height?: string;
};

export default function MapLeaflet({
  center = [20, 0],
  zoom = 2,
  markers = [],
  height = "360px",
}: Props) {
  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <div style={{ width: "100%", height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%", borderRadius: 12 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={m.id ?? i} position={m.position}>
            <Popup>{m.label ?? "Location"}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
