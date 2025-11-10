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
      {/* readability scrim */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-sm pointer-events-none" />

      {/* centered content with equal left/right padding */}
      <div className="relative z-10 w-full px-2 md:px-4 lg:px-6 py-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
