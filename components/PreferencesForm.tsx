// components/PreferencesForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import LoadingRobot from "./LoadingRobot";

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

type Profile = {
  travelers: Traveler[];
  timeframe: { startMonth: string; endMonth: string };
  suggestions?: string;
};

function uid() {
  try {
    // @ts-ignore
    return crypto?.randomUUID?.() ?? "t_" + Math.random().toString(36).slice(2, 10);
  } catch {
    return "t_" + Math.random().toString(36).slice(2, 10);
  }
}

export default function PreferencesForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showRobot, setShowRobot] = React.useState(false);

  const [travelers, setTravelers] = React.useState<Traveler[]>([
    { id: uid(), name: "", relationship: "me", homeLocation: "", isUser: true, kids: "0" },
  ]);
  const [timeframe, setTimeframe] = React.useState<Profile["timeframe"]>({
    startMonth: "",
    endMonth: "",
  });
  const [suggestions, setSuggestions] = React.useState<string>("");

  // Load saved profile (cookie-backed API)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const p = (await res.json()) as Partial<Profile> | null;
          if (!cancelled && p) {
            if (Array.isArray(p.travelers) && p.travelers.length) {
              setTravelers(
                p.travelers.map((t, i) => ({
                  id: t.id || uid(),
                  name: t.name || "",
                  relationship: t.relationship ?? (i === 0 ? "me" : ""),
                  homeLocation: t.homeLocation || "",
                  age: t.age || "",
                  gender: t.gender || "",
                  personality: t.personality || "",
                  isUser: !!t.isUser || i === 0,
                  spouse: t.spouse || "",
                  kids: (t.kids ?? "0").toString(),
                }))
              );
            }
            if (p.timeframe) {
              setTimeframe({
                startMonth: p.timeframe.startMonth || "",
                endMonth: p.timeframe.endMonth || "",
              });
            }
            if (typeof p.suggestions === "string") setSuggestions(p.suggestions);
          }
        }
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Mutators
  const updateTraveler = (idx: number, patch: Partial<Traveler>) =>
    setTravelers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });

  const addTraveler = () =>
    setTravelers(prev => [
      ...prev,
      { id: uid(), name: "", relationship: "", homeLocation: "", kids: "0" },
    ]);

  const removeTraveler = (idx: number) =>
    setTravelers(prev => prev.filter((_, i) => i !== idx));

  const markAsMe = (idx: number) =>
    setTravelers(prev =>
      prev.map((t, i) => (i === idx ? { ...t, isUser: true } : { ...t, isUser: false }))
    );

  // Submit
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Profile = {
      travelers: travelers.map(t => ({
        id: t.id || uid(),
        name: (t.name || "").trim(),
        relationship: (t.relationship || "").trim() || undefined,
        homeLocation: (t.homeLocation || "").trim(),
        age: (t.age || "").trim() || undefined,
        gender: (t.gender || "").trim() || undefined,
        personality: (t.personality || "").trim() || undefined,
        isUser: !!t.isUser,
        spouse: (t.spouse || "").trim() || undefined,
        kids: (t.kids ?? "0").toString(),
      })),
      timeframe: {
        startMonth: (timeframe.startMonth || "").trim(),
        endMonth: (timeframe.endMonth || "").trim(),
      },
      suggestions: suggestions?.trim() || undefined,
    };

    try {
      // Save profile
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Show the dancing robot while planning
      setShowRobot(true);

      // Create plan
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!planRes.ok) {
        const text = await planRes.text();
        throw new Error(text || "Planner failed");
      }
      const { planId } = await planRes.json();
      router.push(`/results/${planId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to generate plan");
      setShowRobot(false);
      setSaving(false);
      return;
    }
  }

  async function onClearProfile() {
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/profile", { method: "DELETE" });
      setTravelers([{ id: uid(), name: "", relationship: "me", homeLocation: "", isUser: true, kids: "0" }]);
      setTimeframe({ startMonth: "", endMonth: "" });
      setSuggestions("");
    } catch (e: any) {
      setError(e?.message || "Failed to clear profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <>
      {showRobot && <LoadingRobot />}

      {/* matches the screenshot layout/labels closely */}
      <form onSubmit={onSave} className="space-y-6">
        {/* Group details */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Group details</h3>
          <p className="text-sm text-gray-600">
            Add everyone going on the trip. For any traveler who <em>dislikes travel</em>, include that phrase
            in their personality — the planner will try to center the search near their home.
          </p>

          <div className="mt-4 space-y-4">
            {travelers.map((t, idx) => (
              <div key={t.id} className="rounded-xl border bg-gray-50 p-3">
                <div className="mb-2 text-sm font-medium">
                  Person {idx + 1} {t.isUser ? <span className="text-pink-600">(you)</span> : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Full name"
                    value={t.name}
                    onChange={(e) => updateTraveler(idx, { name: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Relationship"
                    value={t.relationship || ""}
                    onChange={(e) => updateTraveler(idx, { relationship: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder='Home location (e.g., "LAX" or "Seattle, WA")'
                    value={t.homeLocation}
                    onChange={(e) => updateTraveler(idx, { homeLocation: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Age"
                    value={t.age || ""}
                    onChange={(e) => updateTraveler(idx, { age: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Gender"
                    value={t.gender || ""}
                    onChange={(e) => updateTraveler(idx, { gender: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Spouse name (optional)"
                    value={t.spouse || ""}
                    onChange={(e) => updateTraveler(idx, { spouse: e.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2"
                    placeholder="Number of kids"
                    value={t.kids ?? "0"}
                    onChange={(e) => updateTraveler(idx, { kids: e.target.value })}
                  />
                  <textarea
                    className="w-full rounded-md border p-2 sm:col-span-3"
                    placeholder='Short personality notes (e.g., "dislikes travel", "foodie, loves beaches")'
                    value={t.personality || ""}
                    onChange={(e) => updateTraveler(idx, { personality: e.target.value })}
                  />
                </div>

                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!t.isUser} onChange={() => markAsMe(idx)} />
                  This person is me
                </label>

                {travelers.length > 1 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => removeTraveler(idx)}
                      className="text-sm text-red-600 underline"
                    >
                      Remove person
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addTraveler}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              + Add another person
            </button>
          </div>
        </div>

        {/* Timeframe */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Target timeframe (required)</h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="month"
              className="w-full rounded-md border p-2"
              value={timeframe.startMonth}
              onChange={(e) => setTimeframe(t => ({ ...t, startMonth: e.target.value }))}
              placeholder="Start month"
            />
            <input
              type="month"
              className="w-full rounded-md border p-2"
              value={timeframe.endMonth}
              onChange={(e) => setTimeframe(t => ({ ...t, endMonth: e.target.value }))}
              placeholder="End month"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Any ideas or must-haves?</h3>
          <textarea
            className="mt-3 w-full rounded-md border p-2 min-h-[90px]"
            placeholder="Optional: list a few destination ideas, activities, or constraints (school schedule, mobility, etc.)"
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            We’ll ask the planner to propose 5 locations, estimate flight costs per traveler and per month,
            and choose a best overall recommendation for the group.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-pink-600 px-4 py-2 text-white hover:bg-pink-700"
          >
            {saving ? "Saving…" : "Save & Generate Plan"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClearProfile}
            className="rounded-md border px-3 py-2"
          >
            Clear profile
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </>
  );
}
