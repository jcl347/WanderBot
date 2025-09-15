"use client";
import PreferencesForm from "@/components/PreferencesForm";
import WanderHero from "@/components/WanderHero";
import Link from "next/link";
import HomeMap from "@/components/HomeMap";
import { useState } from "react";

export default function Main() {
  // for demo: show a dancing bot while the form is submitting (PreferenceForm can call setPlanning)
  const [planning, setPlanning] = useState(false);

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        backgroundImage: `url("https://tile.openstreetmap.org/0/0/0.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-white/75 backdrop-blur-sm" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:py-10 space-y-8">
        <WanderHero />

        {/* cute dancing robot while planning */}
        {planning && (
          <div className="rounded-xl border bg-white/80 p-4 flex items-center gap-4 shadow-sm">
            <RobotDance />
            <div>
              <div className="font-medium">Wander Bot is planning…</div>
              <div className="text-sm text-neutral-600">
                Crunching costs, balancing interests, and ranking destinations.
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <section className="grid gap-4 md:grid-cols-4">
          {[
            {
              emoji: "📝",
              title: "Tell us who’s going",
              blurb:
                "Add travelers, home bases, and notes (include “dislikes travel” to center around them).",
            },
            {
              emoji: "🧮",
              title: "We crunch costs",
              blurb:
                "Estimate round-trip averages per traveler and per month for your timeframe.",
            },
            {
              emoji: "🗺️",
              title: "Compare 5 places",
              blurb:
                "See why each destination fits your crew, with pros/cons and photos.",
            },
            {
              emoji: "🏁",
              title: "Get a pick & charts",
              blurb:
                "Clear recommendation plus group total vs. per-person comparisons.",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-xl border bg-white/80 backdrop-blur-sm p-4 shadow-sm"
            >
              <div className="text-2xl">{s.emoji}</div>
              <div className="mt-2 font-semibold">{s.title}</div>
              <p className="text-sm text-neutral-600">{s.blurb}</p>
            </div>
          ))}
        </section>

        {/* NEW: homepage map */}
        <section className="rounded-2xl border bg-white/85 backdrop-blur p-4 shadow-md">
          <h2 className="text-lg font-semibold mb-2">Where could you go?</h2>
          <p className="text-sm text-neutral-600 mb-3">
            Here are a few example spots Wander Bot might consider for typical groups.
          </p>
          <HomeMap />
        </section>

        {/* The form (pass a setter so we can show “planning…”) */}
        <section className="rounded-2xl border bg-white/90 backdrop-blur p-4 md:p-6 shadow-md">
          <PreferencesForm onPlanningChange={setPlanning} />
          {process.env.NEXT_PUBLIC_SHOW_DEMO === "1" && (
            <div className="mt-3 text-sm">
              <Link href="/results/demo" className="text-sky-700 underline">
                View demo results →
              </Link>
            </div>
          )}
        </section>

        <footer className="pb-8">
          <div className="rounded-2xl bg-gradient-to-br from-sky-100/70 to-emerald-100/70 p-6 text-sm text-neutral-700 shadow">
            <h2 className="mb-2 text-base font-semibold">What is this?</h2>
            <p>
              Wander Bot is for <strong>groups that aren’t sure where to go</strong>.
              It balances interests, estimates flight costs across months and travelers,
              and presents options in a clean, visual way so you can choose with confidence.
              It doesn’t book anything—think of it as your unbiased pre-trip analyst.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// simple dancing robot SVG with CSS bounce
function RobotDance() {
  return (
    <div className="h-16 w-16 animate-bounce">
      <svg viewBox="0 0 320 280" className="h-full w-full" aria-hidden="true">
        <circle cx="260" cy="58" r="26" fill="#FDE68A" />
        <rect x="110" y="120" width="100" height="70" rx="14" fill="#0EA5E9" />
        <rect x="125" y="130" width="70" height="32" rx="8" fill="#E0F2FE" />
        <circle cx="145" cy="146" r="6" fill="#0C4A6E" />
        <circle cx="175" cy="146" r="6" fill="#0C4A6E" />
        <path d="M142 156c8 8 28 8 36 0" stroke="#0C4A6E" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="160" y1="110" x2="160" y2="98" stroke="#0369A1" strokeWidth="4" />
        <circle cx="160" cy="94" r="6" fill="#22D3EE" />
      </svg>
    </div>
  );
}
