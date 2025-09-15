// components/PreferencesForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Traveler = {
  id: string;
  name: string;
  relationship?: string;
  homeLocation: string;
  age?: string;
  gender?: string;
  personality?: string;
  isUser?: boolean;
  spouse?: string;
  kids?: string;
};

export default function PreferencesForm({
  onPlanningChange,
}: {
  onPlanningChange?: (v: boolean) => void;
}) {
  const router = useRouter();

  // Lint-safe UUID without ts-ignore
  function safeUuid(): string {
    const c: unknown = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof (c as any).randomUUID === "function") {
      return (c as any).randomUUID();
    }
    // RFC4122-ish fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function emptyTraveler(initial?: Partial<Traveler>): Traveler {
    return {
      id: safeUuid(),
      name: "",
      relationship: "",
      homeLocation: "",
      age: "",
      gender: "",
      personality: "",
      isUser: false,
      spouse: "",
      kids: "",
      ...initial,
    };
  }

  const [travelers, setTravelers] = useState<Traveler[]>([
    emptyTraveler({ isUser: true, relationship: "me" }),
  ]);
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function updateTraveler(id: string, patch: Partial<Traveler>) {
    setTravelers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function addTraveler() {
    setTravelers((prev) => [...prev, emptyTraveler()]);
  }
  function removeTraveler(id: string) {
    setTravelers((prev) => prev.filter((t) => t.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!startMonth || !endMonth) {
      alert("Please select a start and end month.");
      return;
    }
    if (travelers.some((t) => !t.name || !t.homeLocation)) {
      alert("Each traveler needs at least a name and home location.");
      return;
    }

    setSaving(true);
    onPlanningChange?.(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelers,
          timeframe: { startMonth, endMonth },
          suggestions,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Planning failed");
      }

      const { planId } = await res.json();
      router.push(`/results/${planId}`);
    } catch (err: any) {
      alert(err?.message || "Planning failed");
      setSaving(false);
      onPlanningChange?.(false);
    }
  }

  return (
    <section className="rounded-xl border bg-white p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Group details</h2>
        <p className="text-sm text-neutral-500">
          Add everyone going on the trip. For any traveler who <em>dislikes travel</em>, include that phrase in their
          personality — the planner will try to center the search near their home.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Travelers list */}
        <div className="space-y-4">
          {travelers.map((t, idx) => (
            <div key={t.id} className="rounded-lg border p-4 space-y-3 bg-white/95">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Person {idx + 1} {t.isUser && <span className="ml-1 text-xs text-pink-600">(you)</span>}
                </div>
                {travelers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTraveler(t.id)}
                    className="text-xs text-neutral-600 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Full name"
                  value={t.name}
                  onChange={(e) => updateTraveler(t.id, { name: e.target.value })}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder='Relationship (e.g., "me", spouse, friend, parent)'
                  value={t.relationship ?? ""}
                  onChange={(e) => updateTraveler(t.id, { relationship: e.target.value })}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder='Home location (e.g., "LAX" or "Seattle, WA")'
                  value={t.homeLocation}
                  onChange={(e) => updateTraveler(t.id, { homeLocation: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Age"
                  value={t.age ?? ""}
                  onChange={(e) => updateTraveler(t.id, { age: e.target.value })}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Gender"
                  value={t.gender ?? ""}
                  onChange={(e) => updateTraveler(t.id, { gender: e.target.value })}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Spouse name (optional)"
                  value={t.spouse ?? ""}
                  onChange={(e) => updateTraveler(t.id, { spouse: e.target.value })}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Number of kids"
                  inputMode="numeric"
                  value={t.kids ?? ""}
                  onChange={(e) => updateTraveler(t.id, { kids: e.target.value.replace(/[^\d]/g, "") })}
                />
              </div>

              <textarea
                className="w-full border rounded px-3 py-2"
                placeholder='Short personality notes (e.g., "dislikes travel", "foodie, loves beaches")'
                value={t.personality ?? ""}
                onChange={(e) => updateTraveler(t.id, { personality: e.target.value })}
              />

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.isUser ?? false}
                  onChange={(e) => updateTraveler(t.id, { isUser: e.target.checked })}
                />
                This person is me
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={addTraveler}
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            + Add another person
          </button>
        </div>

        {/* Timeframe */}
        <div className="space-y-2">
          <h3 className="text-base font-medium">Target timeframe (required)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Start month</label>
              <input
                type="month"
                className="border rounded px-3 py-2 w-full"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">End month</label>
              <input
                type="month"
                className="border rounded px-3 py-2 w-full"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Seed ideas / suggestions */}
        <div className="space-y-2">
          <h3 className="text-base font-medium">Any ideas or must-haves?</h3>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="Optional: list a few destination ideas, activities, or constraints (school schedule, mobility, etc.)"
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
          />
          <p className="text-xs text-neutral-500">
            We’ll ask the planner to propose 5 locations, estimate flight costs per traveler and per month,
            and choose a best overall recommendation for the group.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-pink-600 text-white px-4 py-2 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Planning…" : "Save & Generate Plan"}
          </button>
        </div>
      </form>
    </section>
  );
}
