// components/LoadingRobot.tsx
"use client";
import React from "react";

export default function LoadingRobot() {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-white/70 backdrop-blur">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 animate-bounce">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <rect x="50" y="70" width="100" height="60" rx="12" fill="#0EA5E9" />
              <rect x="65" y="80" width="70" height="28" rx="8" fill="#E0F2FE" />
              <circle cx="85" cy="94" r="5" fill="#0C4A6E" />
              <circle cx="110" cy="94" r="5" fill="#0C4A6E" />
              <path d="M84 102c6 6 20 6 26 0" stroke="#0C4A6E" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <line x1="100" y1="60" x2="100" y2="50" stroke="#0369A1" strokeWidth="4" />
              <circle cx="100" cy="46" r="5" fill="#22D3EE" />
            </svg>
          </div>
          <div className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-sky-200 animate-pulse" />
        </div>
        <div className="text-sm text-sky-900">Planning your trip…</div>
      </div>
    </div>
  );
}
