"use client";
import PreferencesForm from "@/components/PreferencesForm";
import WanderHero from "@/components/WanderHero";
import Link from "next/link";

export default function Main() {
  return (
    <div
      className="min-h-screen w-full relative z-0"
      style={{
        backgroundImage: `url("https://tile.openstreetmap.org/0/0/0.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay tint sits BEHIND and doesn't block clicks */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-sm pointer-events-none -z-10" />

      {/* Content sits ABOVE */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:py-10 space-y-8">
        {/* Hero / banner */}
        <WanderHero />

        {/* Quick “How it works” */}
        <section className="grid gap-4 md:grid-cols-4">
          {[
            { emoji: "📝", title: "Tell us who’s going", blurb: "Add travelers, home bases, and notes (include “dislikes travel” for anyone we should center around)." },
            { emoji: "🧮", title: "We crunch costs", blurb: "Estimate round-trip averages per traveler and per month for your timeframe." },
            { emoji: "🗺️", title: "Compare 5 places", blurb: "See why each destination fits your crew, with pros/cons and photo prompts." },
            { emoji: "🏁", title: "Get a pick & charts", blurb: "Clear recommendation plus group total vs. per-person comparisons." },
          ].map((s) => (
            <div key={s.title} className="rounded-xl border bg-white/80 backdrop-blur-sm p-4 shadow-sm">
              <div className="text-2xl">{s.emoji}</div>
              <div className="mt-2 font-semibold">{s.title}</div>
              <p className="text-sm text-neutral-600">{s.blurb}</p>
            </div>
          ))}
        </section>

        {/* The form */}
        <section className="rounded-2xl border bg-white/90 backdrop-blur p-4 md:p-6 shadow-md">
          <PreferencesForm />
          {process.env.NEXT_PUBLIC_SHOW_DEMO === "1" && (
            <div className="mt-3 text-sm">
              <Link href="/results/demo" className="text-sky-700 underline">
                View demo results →
              </Link>
            </div>
          )}
        </section>

        {/* Footer / purpose */}
        <footer className="pb-8">
          <div className="rounded-2xl bg-gradient-to-br from-sky-100/70 to-emerald-100/70 p-6 text-sm text-neutral-700 shadow">
            <h2 className="mb-2 text-base font-semibold">What is this?</h2>
            <p>
              Wander Bot is for <strong>groups that aren’t sure where to go</strong>. It balances interests,
              estimates flight costs across months and travelers, and presents options in a clean, visual way
              so you can choose with confidence. It doesn’t book anything—think of it as your unbiased pre-trip analyst.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
