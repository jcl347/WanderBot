// components/BackgroundMap.tsx
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
      className={`min-h-screen w-full relative ${className}`}
      style={{
        backgroundImage: `url("https://tile.openstreetmap.org/0/0/0.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-white/75 backdrop-blur-sm pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 space-y-6">{children}</div>
    </div>
  );
}
