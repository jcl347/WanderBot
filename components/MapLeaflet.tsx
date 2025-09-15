// components/MapLeaflet.tsx
"use client";
import dynamic from "next/dynamic";

export type LeafletMarker = { position: [number, number]; label?: string };
type Props = { center: [number, number]; zoom?: number; markers?: LeafletMarker[] };

const Inner = dynamic(() => import("./MapLeafletInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-sky-100" />,
});

export default function MapLeaflet(props: Props) {
  return <Inner {...props} />;
}
