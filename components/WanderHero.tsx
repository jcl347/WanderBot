// components/WanderHero.tsx
"use client";
import React from "react";

export default function WanderHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-12 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative z-10 grid gap-6 p-7 md:grid-cols-[1.2fr,1fr] md:p-10">
        <div className="space-y-3 md:space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200 backdrop-blur">
            <span>🧭 Your group trip co-pilot</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Wander <span className="text-sky-600">Bot</span>
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-neutral-700 sm:text-base">
            Tell us who’s going and your timeframe. Wander Bot compares 5 smart
            destinations, estimates flight costs per traveler and per month,
            and gives a clear recommendation—plus pretty charts. ✈️📊
          </p>

          <ul className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <span>✅</span>
              <span>Balances interests (kids, foodies, chill-seekers…)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>💸</span>
              <span>Optimizes for total group cost</span>
            </li>
            <li className="flex items-start gap-2">
              <span>🧑‍🦽</span>
              <span>Respects constraints (mobility, schedules)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📆</span>
              <span>Month-by-month fare notes & trends</span>
            </li>
          </ul>
        </div>

        {/* Vacationing robot */}
        <div className="mx-auto flex w-full max-w-[360px] items-center justify-center">
          <svg
            viewBox="0 0 320 280"
            className="h-auto w-full drop-shadow-sm"
            aria-hidden="true"
          >
            {/* sun */}
            <circle cx="260" cy="58" r="26" fill="#FDE68A" />
            {/* beach */}
            <path d="M0 220h320v60H0z" fill="#FDE68A" />
            {/* ocean */}
            <path d="M0 200h320v20H0z" fill="#93C5FD" />
            {/* umbrella */}
            <path d="M90 135l60-18 60 18-60 18z" fill="#FB7185" />
            <rect x="148" y="153" width="4" height="60" fill="#EA580C" />
            {/* bot body */}
            <rect x="110" y="120" width="100" height="70" rx="14" fill="#0EA5E9" />
            {/* face plate */}
            <rect x="125" y="130" width="70" height="32" rx="8" fill="#E0F2FE" />
            {/* eyes */}
            <circle cx="145" cy="146" r="6" fill="#0C4A6E" />
            <circle cx="175" cy="146" r="6" fill="#0C4A6E" />
            {/* smile */}
            <path
              d="M142 156c8 8 28 8 36 0"
              stroke="#0C4A6E"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            {/* floaty & drink */}
            <circle cx="210" cy="185" r="16" fill="#34D399" />
            <rect x="220" y="160" width="10" height="16" rx="2" fill="#FCA5A5" />
            <rect x="224" y="156" width="2" height="8" rx="1" fill="#10B981" />
            {/* antenna */}
            <line x1="160" y1="110" x2="160" y2="98" stroke="#0369A1" strokeWidth="4" />
            <circle cx="160" cy="94" r="6" fill="#22D3EE" />
          </svg>
        </div>
      </div>
    </div>
  );
}
