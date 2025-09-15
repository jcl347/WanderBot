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

  function emptyTraveler(initial?: Partial<Traveler>): Traveler {
    return {
      id: crypto.randomUUID(),
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
      return;
    }
  }

  return (
    <section className="rounded-xl border bg-white p-4 md:p-6 space-y-6">
      {/* ... keep your existing form UI ... */}
      {/* (no changes to the JSX other than the submit handler / saving state) */}
      <form onSubmit={onSubmit} className="space-y-6">
        {/* your existing inputs... */}
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
