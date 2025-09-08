// components/RobotBadge.tsx
import React from "react";

export default function RobotBadge({ size = 64 }: { size?: number }) {
  return (
    <div className="inline-flex items-center gap-3">
      <svg viewBox="0 0 320 280" width={size} height={size} aria-hidden="true">
        <circle cx="260" cy="58" r="26" fill="#FDE68A" />
        <path d="M0 220h320v60H0z" fill="#FDE68A" />
        <path d="M0 200h320v20H0z" fill="#93C5FD" />
        <path d="M90 135l60-18 60 18-60 18z" fill="#FB7185" />
        <rect x="148" y="153" width="4" height="60" fill="#EA580C" />
        <rect x="110" y="120" width="100" height="70" rx="14" fill="#0EA5E9" />
        <rect x="125" y="130" width="70" height="32" rx="8" fill="#E0F2FE" />
        <circle cx="145" cy="146" r="6" fill="#0C4A6E" />
        <circle cx="175" cy="146" r="6" fill="#0C4A6E" />
        <path d="M142 156c8 8 28 8 36 0" stroke="#0C4A6E" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="210" cy="185" r="16" fill="#34D399" />
        <rect x="220" y="160" width="10" height="16" rx="2" fill="#FCA5A5" />
        <rect x="224" y="156" width="2" height="8" rx="1" fill="#10B981" />
        <line x1="160" y1="110" x2="160" y2="98" stroke="#0369A1" strokeWidth="4" />
        <circle cx="160" cy="94" r="6" fill="#22D3EE" />
      </svg>
      <div className="leading-tight">
        <div className="text-xs font-medium text-sky-700">Wander Bot</div>
        <div className="text-sm text-neutral-700">Trip Planner</div>
      </div>
    </div>
  );
}
